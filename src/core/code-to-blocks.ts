import type { BlockRegistry } from './block-registry'
import type { CppParser } from '../languages/cpp/parser'
import type { BlockSpec } from './types'
import type { Node } from 'web-tree-sitter'

interface BlockJSON {
  type: string
  id: string
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: BlockJSON }>
  next?: { block: BlockJSON }
}

interface WorkspaceJSON {
  blocks: {
    languageVersion: number
    blocks: BlockJSON[]
  }
}

let blockIdCounter = 0

function nextBlockId(): string {
  return `block_${++blockIdCounter}`
}

export class CodeToBlocksConverter {
  private registry: BlockRegistry
  private parser: CppParser

  constructor(registry: BlockRegistry, parser: CppParser) {
    this.registry = registry
    this.parser = parser
  }

  async convert(code: string): Promise<WorkspaceJSON> {
    blockIdCounter = 0
    const tree = await this.parser.parse(code)
    const rootNode = tree.rootNode
    const topBlocks = this.convertChildren(rootNode)

    // Chain top-level blocks via next
    const chainedBlocks = this.chainStatements(topBlocks)

    return {
      blocks: {
        languageVersion: 0,
        blocks: chainedBlocks,
      },
    }
  }

  private convertNode(node: Node): BlockJSON | null {
    // Skip unnamed nodes (punctuation, etc.)
    if (!node.isNamed) return null

    // Try to find a matching block spec by node type
    const specs = this.registry.getByNodeType(node.type)

    if (specs.length > 0) {
      // Find the best matching spec (check constraints)
      const spec = this.findBestMatch(specs, node)
      if (spec) {
        return this.buildBlock(spec, node)
      }
    }

    // Special handling for known compound nodes
    if (node.type === 'translation_unit') {
      return null // handled by convertChildren
    }

    if (node.type === 'compound_statement') {
      return null // handled by parent
    }

    // Fallback: raw code block
    return this.buildRawCodeBlock(node)
  }

  private findBestMatch(specs: BlockSpec[], node: Node): BlockSpec | null {
    // First try specs with constraints
    for (const spec of specs) {
      if (spec.astPattern.constraints.length > 0) {
        if (this.matchConstraints(spec, node)) {
          return spec
        }
      }
    }

    // Then try specs without constraints (generic match)
    for (const spec of specs) {
      if (spec.astPattern.constraints.length === 0) {
        return spec
      }
    }

    return null
  }

  private matchConstraints(spec: BlockSpec, node: Node): boolean {
    for (const constraint of spec.astPattern.constraints) {
      if (constraint.field === 'function' && constraint.text) {
        // Check if call_expression's function name matches
        const funcNode = node.childForFieldName('function')
        if (!funcNode || funcNode.text !== constraint.text) return false
      } else if (constraint.field === 'operator' && constraint.text) {
        const opNode = node.childForFieldName('operator')
        if (!opNode || opNode.text !== constraint.text) return false
      } else if (constraint.field === 'alternative' && constraint.nodeType) {
        // Check if node has an alternative (else clause)
        const alt = node.childForFieldName('alternative')
        if (!alt) return false
      } else if (constraint.field === 'child' && constraint.nodeType) {
        // Check if any child matches the node type
        let found = false
        for (const child of node.namedChildren) {
          if (child.type === constraint.nodeType) { found = true; break }
        }
        if (!found) return false
      } else if (constraint.field === 'declarator' && constraint.nodeType) {
        const decl = node.childForFieldName('declarator')
        if (!decl || decl.type !== constraint.nodeType) {
          // Also check nested declarators
          let found = false
          for (const child of node.namedChildren) {
            if (child.type === constraint.nodeType) { found = true; break }
            // Check within init_declarator
            if (child.type === 'init_declarator') {
              for (const grandchild of child.namedChildren) {
                if (grandchild.type === constraint.nodeType) { found = true; break }
              }
            }
          }
          if (!found) return false
        }
      } else if (constraint.field === 'path' && constraint.nodeType) {
        // Check include path type
        const pathNode = node.childForFieldName('path')
        if (!pathNode || pathNode.type !== constraint.nodeType) return false
      }
    }
    return true
  }

  private buildBlock(spec: BlockSpec, node: Node): BlockJSON {
    const block: BlockJSON = {
      type: spec.id,
      id: nextBlockId(),
    }

    // Extract fields and inputs from the node based on the code template
    const { fields, inputs } = this.extractFieldsAndInputs(spec, node)

    if (Object.keys(fields).length > 0) {
      block.fields = fields
    }

    if (Object.keys(inputs).length > 0) {
      block.inputs = inputs
    }

    return block
  }

  private extractFieldsAndInputs(spec: BlockSpec, node: Node): {
    fields: Record<string, unknown>
    inputs: Record<string, { block: BlockJSON }>
  } {
    const fields: Record<string, unknown> = {}
    const inputs: Record<string, { block: BlockJSON }> = {}

    // Parse template placeholders
    const placeholders = this.getTemplatePlaceholders(spec.codeTemplate.pattern)

    for (const name of placeholders) {
      const value = this.extractValue(spec, node, name)
      if (value !== null) {
        if (typeof value === 'object' && 'type' in value) {
          inputs[name] = { block: value as BlockJSON }
        } else {
          fields[name] = value
        }
      }
    }

    // Handle statement body (BODY, THEN, ELSE, etc.)
    this.extractStatementInputs(spec, node, inputs)

    return { fields, inputs }
  }

  private extractValue(spec: BlockSpec, node: Node, name: string): unknown {
    // Map placeholder names to tree-sitter node fields
    switch (spec.astPattern.nodeType) {
      case 'for_statement':
        return this.extractForValue(node, name)
      case 'if_statement':
        return this.extractIfValue(node, name)
      case 'function_definition':
        return this.extractFunctionDefValue(node, name)
      case 'return_statement':
        return this.extractReturnValue(node, name)
      case 'declaration':
        return this.extractDeclarationValue(node, name)
      case 'call_expression':
        return this.extractCallExprValue(spec, node, name)
      case 'binary_expression':
        return this.extractBinaryExprValue(node, name)
      case 'unary_expression':
      case 'pointer_expression':
        return this.extractUnaryExprValue(node, name)
      case 'preproc_include':
        return this.extractIncludeValue(node, name)
      case 'preproc_def':
        return this.extractDefineValue(node, name)
      case 'number_literal':
        if (name === 'NUM') return node.text
        break
      case 'identifier':
        if (name === 'NAME') return node.text
        break
      case 'string_literal':
        if (name === 'TEXT') return node.text.replace(/^"|"$/g, '')
        break
      case 'char_literal':
        if (name === 'CHAR') return node.text.replace(/^'|'$/g, '')
        break
      case 'update_expression':
        return this.extractUpdateExprValue(node, name)
      case 'subscript_expression':
        return this.extractSubscriptValue(node, name)
      case 'field_expression':
        return this.extractFieldExprValue(node, name)
      case 'expression_statement':
        return this.extractExprStmtValue(node, name)
    }

    return null
  }

  private extractForValue(node: Node, name: string): unknown {
    switch (name) {
      case 'INIT': {
        const init = node.childForFieldName('initializer')
        return init ? this.convertToExpression(init) : null
      }
      case 'COND': {
        const cond = node.childForFieldName('condition')
        return cond ? this.convertToExpression(cond) : null
      }
      case 'UPDATE': {
        const update = node.childForFieldName('update')
        return update ? this.convertToExpression(update) : null
      }
    }
    return null
  }

  private extractIfValue(node: Node, name: string): unknown {
    if (name === 'COND') {
      const cond = node.childForFieldName('condition')
      if (cond) {
        // condition is wrapped in parenthesized_expression
        if (cond.type === 'parenthesized_expression' && cond.namedChildren.length > 0) {
          return this.convertToExpression(cond.namedChildren[0])
        }
        return this.convertToExpression(cond)
      }
    }
    return null
  }

  private extractFunctionDefValue(node: Node, name: string): unknown {
    switch (name) {
      case 'RETURN_TYPE': {
        const typeNode = node.childForFieldName('type')
        return typeNode?.text ?? 'void'
      }
      case 'NAME': {
        const declarator = node.childForFieldName('declarator')
        if (declarator?.type === 'function_declarator') {
          const nameNode = declarator.childForFieldName('declarator')
          return nameNode?.text ?? ''
        }
        return declarator?.text ?? ''
      }
      case 'PARAMS': {
        const declarator = node.childForFieldName('declarator')
        if (declarator?.type === 'function_declarator') {
          const params = declarator.childForFieldName('parameters')
          if (params) {
            // Extract parameter text without the parentheses
            const text = params.text
            return text.replace(/^\(|\)$/g, '')
          }
        }
        return ''
      }
    }
    return null
  }

  private extractReturnValue(node: Node, name: string): unknown {
    if (name === 'VALUE') {
      // return statement's expression child
      for (const child of node.namedChildren) {
        if (child.type !== 'return') {
          return this.convertToExpression(child)
        }
      }
    }
    return null
  }

  private extractDeclarationValue(node: Node, name: string): unknown {
    switch (name) {
      case 'TYPE': {
        const typeNode = node.childForFieldName('type')
        return typeNode?.text ?? ''
      }
      case 'NAME': {
        const declarator = node.childForFieldName('declarator')
        if (declarator?.type === 'init_declarator') {
          const nameNode = declarator.childForFieldName('declarator')
          return nameNode?.text ?? ''
        }
        return declarator?.text ?? ''
      }
      case 'INIT': {
        const declarator = node.childForFieldName('declarator')
        if (declarator?.type === 'init_declarator') {
          const value = declarator.childForFieldName('value')
          if (value) return this.convertToExpression(value)
        }
        return null
      }
      case 'SIZE': {
        const declarator = node.childForFieldName('declarator')
        if (declarator?.type === 'array_declarator') {
          const size = declarator.childForFieldName('size')
          if (size) return this.convertToExpression(size)
        }
        return null
      }
    }
    return null
  }

  private extractCallExprValue(spec: BlockSpec, node: Node, name: string): unknown {
    if (spec.id === 'c_printf' || spec.id === 'c_scanf') {
      return this.extractPrintfScanfValue(node, name)
    }

    switch (name) {
      case 'NAME': {
        const func = node.childForFieldName('function')
        return func?.text ?? ''
      }
      case 'ARGS': {
        const args = node.childForFieldName('arguments')
        if (args) {
          return args.text.replace(/^\(|\)$/g, '')
        }
        return ''
      }
    }
    return null
  }

  private extractPrintfScanfValue(node: Node, name: string): unknown {
    const args = node.childForFieldName('arguments')
    if (!args) return ''

    const argNodes = args.namedChildren
    if (name === 'FORMAT' && argNodes.length > 0) {
      return argNodes[0].text.replace(/^"|"$/g, '')
    }
    if (name === 'ARGS') {
      if (argNodes.length > 1) {
        const remaining = argNodes.slice(1).map(n => n.text).join(', ')
        return ', ' + remaining
      }
      return ''
    }
    return ''
  }

  private extractBinaryExprValue(node: Node, name: string): unknown {
    switch (name) {
      case 'A': {
        const left = node.childForFieldName('left')
        return left ? this.convertToExpression(left) : null
      }
      case 'B': {
        const right = node.childForFieldName('right')
        return right ? this.convertToExpression(right) : null
      }
      case 'OP': {
        const op = node.childForFieldName('operator')
        return op?.text ?? ''
      }
    }
    return null
  }

  private extractUnaryExprValue(node: Node, name: string): unknown {
    switch (name) {
      case 'A':
      case 'PTR':
      case 'VAR': {
        const operand = node.childForFieldName('argument') ?? node.childForFieldName('operand')
        return operand ? this.convertToExpression(operand) : null
      }
      case 'OP': {
        const op = node.childForFieldName('operator')
        return op?.text ?? ''
      }
    }
    return null
  }

  private extractIncludeValue(node: Node, name: string): unknown {
    if (name === 'HEADER') {
      const path = node.childForFieldName('path')
      if (path) {
        // Remove < > or " "
        return path.text.replace(/^[<"]|[>"]$/g, '')
      }
    }
    return null
  }

  private extractDefineValue(node: Node, name: string): unknown {
    switch (name) {
      case 'NAME': {
        const nameNode = node.childForFieldName('name')
        return nameNode?.text ?? ''
      }
      case 'VALUE': {
        const value = node.childForFieldName('value')
        return value?.text ?? ''
      }
    }
    return null
  }

  private extractUpdateExprValue(node: Node, name: string): unknown {
    switch (name) {
      case 'NAME': {
        const arg = node.childForFieldName('argument')
        return arg?.text ?? ''
      }
      case 'OP': {
        const op = node.childForFieldName('operator')
        return op?.text ?? ''
      }
    }
    return null
  }

  private extractSubscriptValue(node: Node, name: string): unknown {
    switch (name) {
      case 'ARRAY': {
        const arg = node.childForFieldName('argument')
        return arg?.text ?? ''
      }
      case 'INDEX': {
        const idx = node.childForFieldName('index')
        return idx ? this.convertToExpression(idx) : null
      }
    }
    return null
  }

  private extractFieldExprValue(node: Node, name: string): unknown {
    switch (name) {
      case 'OBJ':
      case 'PTR': {
        const arg = node.childForFieldName('argument')
        return arg?.text ?? ''
      }
      case 'MEMBER': {
        const field = node.childForFieldName('field')
        return field?.text ?? ''
      }
    }
    return null
  }

  private extractExprStmtValue(node: Node, name: string): unknown {
    if (node.namedChildren.length > 0) {
      const child = node.namedChildren[0]
      return this.convertToExpression(child)
    }
    return null
  }

  private extractStatementInputs(spec: BlockSpec, node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    // Extract body/then/else statement inputs
    const pattern = spec.codeTemplate.pattern

    if (pattern.includes('${BODY}')) {
      const body = this.getBodyNode(spec, node)
      if (body) {
        const stmts = this.convertChildren(body)
        const chained = this.chainStatements(stmts)
        if (chained.length > 0) {
          inputs['BODY'] = { block: chained[0] }
        }
      }
    }

    if (pattern.includes('${THEN}')) {
      const consequence = node.childForFieldName('consequence')
      if (consequence) {
        const stmts = this.convertChildren(consequence)
        const chained = this.chainStatements(stmts)
        if (chained.length > 0) {
          inputs['THEN'] = { block: chained[0] }
        }
      }
    }

    if (pattern.includes('${ELSE}')) {
      const alt = node.childForFieldName('alternative')
      if (alt) {
        // The else clause wraps a compound_statement
        const elseBody = alt.type === 'else_clause' ? alt.namedChildren[0] : alt
        if (elseBody) {
          const stmts = this.convertChildren(elseBody)
          const chained = this.chainStatements(stmts)
          if (chained.length > 0) {
            inputs['ELSE'] = { block: chained[0] }
          }
        }
      }
    }
  }

  private getBodyNode(spec: BlockSpec, node: Node): Node | null {
    switch (spec.astPattern.nodeType) {
      case 'for_statement':
      case 'while_statement':
      case 'do_statement': {
        return node.childForFieldName('body')
      }
      case 'if_statement': {
        return node.childForFieldName('consequence')
      }
      case 'function_definition': {
        return node.childForFieldName('body')
      }
      case 'switch_statement': {
        return node.childForFieldName('body')
      }
      default: {
        // Try common field name
        return node.childForFieldName('body')
      }
    }
  }

  private convertChildren(node: Node): BlockJSON[] {
    const results: BlockJSON[] = []

    for (const child of node.namedChildren) {
      const block = this.convertNode(child)
      if (block) results.push(block)
    }

    return results
  }

  private convertToExpression(node: Node): BlockJSON | string {
    // Try to convert to a typed block
    const specs = this.registry.getByNodeType(node.type)
    if (specs.length > 0) {
      const spec = this.findBestMatch(specs, node)
      if (spec) {
        return this.buildBlock(spec, node)
      }
    }

    // For parenthesized expressions, unwrap
    if (node.type === 'parenthesized_expression' && node.namedChildren.length > 0) {
      return this.convertToExpression(node.namedChildren[0])
    }

    // Fallback: return as raw expression text
    return node.text
  }

  private chainStatements(blocks: BlockJSON[]): BlockJSON[] {
    if (blocks.length <= 1) return blocks

    // Chain blocks via next pointers
    for (let i = 0; i < blocks.length - 1; i++) {
      blocks[i].next = { block: blocks[i + 1] }
    }

    return [blocks[0]]
  }

  private buildRawCodeBlock(node: Node): BlockJSON {
    return {
      type: 'c_raw_code',
      id: nextBlockId(),
      fields: { CODE: node.text },
    }
  }

  private getTemplatePlaceholders(pattern: string): string[] {
    const matches = pattern.match(/\$\{(\w+)\}/g) ?? []
    return matches.map(m => m.slice(2, -1))
  }
}
