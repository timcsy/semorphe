import type { BlockRegistry } from './block-registry'
import type { CppParser } from '../languages/cpp/parser'
import type { BlockSpec, LanguageAdapter, SourceMapping } from './types'
import type { SemanticModel } from './semantic-model'
import type { NewLanguageAdapter } from '../languages/types'
import type { Node } from 'web-tree-sitter'

interface BlockJSON {
  type: string
  id: string
  x?: number
  y?: number
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: BlockJSON }>
  next?: { block: BlockJSON }
  extraState?: unknown
}

interface WorkspaceJSON {
  blocks: {
    languageVersion: number
    blocks: BlockJSON[]
  }
}

interface ConvertResult {
  workspace: WorkspaceJSON
  mappings: SourceMapping[]
}

let blockIdCounter = 0

function nextBlockId(): string {
  return `block_${++blockIdCounter}`
}

export class CodeToBlocksConverter {
  private registry: BlockRegistry
  private parser: CppParser
  private adapter: LanguageAdapter | null
  private sourceMappings: SourceMapping[] = []

  constructor(registry: BlockRegistry, parser: CppParser, adapter?: LanguageAdapter) {
    this.registry = registry
    this.parser = parser
    this.adapter = adapter ?? null
  }

  async convert(code: string): Promise<WorkspaceJSON> {
    blockIdCounter = 0
    this.sourceMappings = []
    const tree = await this.parser.parse(code)
    const rootNode = tree.rootNode
    const topBlocks = this.convertChildren(rootNode)

    // Chain top-level blocks via next
    const chainedBlocks = this.chainStatements(topBlocks)

    // Add positions to top-level blocks to prevent overlapping
    let y = 30
    for (const block of chainedBlocks) {
      block.x = 30
      block.y = y
      y += this.estimateBlockHeight(block)
    }

    return {
      blocks: {
        languageVersion: 0,
        blocks: chainedBlocks,
      },
    }
  }

  /** Convert with SourceMapping (T014) */
  async convertWithMappings(code: string): Promise<ConvertResult> {
    const workspace = await this.convert(code)
    return { workspace, mappings: this.sourceMappings }
  }

  /** Convert via SemanticModel path (T014): code → SemanticModel → BlockJSON */
  async convertViaSemanticModel(code: string): Promise<{ workspace: WorkspaceJSON; model: SemanticModel }> {
    const cppParser = this.parser as { parseToModel?(code: string): Promise<SemanticModel> }
    if (!cppParser.parseToModel) {
      throw new Error('Parser does not support parseToModel')
    }
    const model = await cppParser.parseToModel(code)
    const semAdapter = this.adapter as unknown as NewLanguageAdapter | null
    if (!semAdapter?.toBlockJSON) {
      throw new Error('Adapter does not support toBlockJSON')
    }

    // Convert program body to BlockJSON
    const body = Array.isArray(model.program.children.body) ? model.program.children.body : []
    const blocks: BlockJSON[] = []
    let y = 30
    for (const node of body) {
      const blockJson = semAdapter.toBlockJSON(node) as BlockJSON
      blockJson.x = 30
      blockJson.y = y
      y += this.estimateBlockHeight(blockJson)
      blocks.push(blockJson)
    }

    return {
      workspace: { blocks: { languageVersion: 0, blocks } },
      model,
    }
  }

  getSourceMappings(): SourceMapping[] {
    return this.sourceMappings
  }

  private convertNode(node: Node): BlockJSON | null {
    // Skip unnamed nodes (punctuation, etc.)
    if (!node.isNamed) return null

    // expression_statement is transparent - process inner expression directly
    if (node.type === 'expression_statement') {
      if (node.namedChildren.length > 0) {
        return this.convertNode(node.namedChildren[0])
      }
      return null
    }

    // Special handling for known compound nodes
    if (node.type === 'translation_unit') {
      return null // handled by convertChildren
    }

    if (node.type === 'compound_statement') {
      return null // handled by parent
    }

    // Try adapter first (concept-based mapping)
    if (this.adapter) {
      const blockId = this.adapter.matchNodeToBlock(node)
      if (blockId) {
        return this.buildBlockFromAdapter(blockId, node)
      }
    }

    // Fallback: try registry (language-specific blocks by AST pattern)
    const specs = this.registry.getByNodeType(node.type)
    if (specs.length > 0) {
      const spec = this.findBestMatch(specs, node)
      if (spec) {
        return this.buildBlock(spec, node)
      }
    }

    // Fallback: raw code block
    return this.buildRawCodeBlock(node)
  }

  private buildBlockFromAdapter(blockId: string, node: Node): BlockJSON {
    const { fields, inputs } = this.adapter!.extractFields(node, blockId)
    const id = nextBlockId()

    const block: BlockJSON = { type: blockId, id }

    if (Object.keys(fields).length > 0) {
      block.fields = fields
    }

    // Fix input block IDs: adapter generates temp IDs, re-assign proper sequential IDs
    const fixedInputs: Record<string, { block: BlockJSON }> = {}
    for (const [key, val] of Object.entries(inputs)) {
      fixedInputs[key] = { block: this.reassignBlockIds(val.block) }
    }
    if (Object.keys(fixedInputs).length > 0) {
      block.inputs = fixedInputs
    }

    // Extract statement inputs (BODY, THEN, ELSE) from the node
    this.extractAdapterStatementInputs(blockId, node, block)

    // Add extraState for dynamic-input blocks (u_print with EXPR0, EXPR1, ...)
    if (block.inputs) {
      const exprCount = Object.keys(block.inputs).filter(k => /^EXPR\d+$/.test(k)).length
      if (exprCount > 0) {
        block.extraState = { itemCount: exprCount }
      }
    }

    // Add varCount for u_input blocks with multiple variables (NAME_0, NAME_1, ...)
    if (blockId === 'u_input' && block.fields) {
      const varCount = Object.keys(block.fields).filter(k => /^NAME_\d+$/.test(k)).length
      if (varCount > 0) {
        block.extraState = { ...(block.extraState ?? {}), varCount }
      }
    }

    // Record source mapping (T014)
    this.sourceMappings.push({
      blockId: id,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
    })

    return block
  }

  private reassignBlockIds(block: BlockJSON): BlockJSON {
    const newBlock: BlockJSON = { ...block, id: nextBlockId() }
    if (block.inputs) {
      const newInputs: Record<string, { block: BlockJSON }> = {}
      for (const [key, val] of Object.entries(block.inputs)) {
        newInputs[key] = { block: this.reassignBlockIds(val.block) }
      }
      newBlock.inputs = newInputs
    }
    if (block.next) {
      newBlock.next = { block: this.reassignBlockIds(block.next.block) }
    }

    // Record source mapping for child blocks too
    // (adapter blocks don't have node refs, skip for now)

    return newBlock
  }

  private extractAdapterStatementInputs(blockId: string, node: Node, block: BlockJSON): void {
    if (!block.inputs) block.inputs = {}

    // Determine which statement inputs this block type has
    const stmtInputs = this.getStatementInputNames(blockId)

    for (const inputName of stmtInputs) {
      const bodyNode = this.getStatementBodyNode(inputName, node)
      if (bodyNode) {
        const stmts = this.convertChildren(bodyNode)
        const chained = this.chainStatements(stmts)
        if (chained.length > 0) {
          block.inputs![inputName] = { block: chained[0] }
        }
      }
    }

    // Clean up empty inputs
    if (Object.keys(block.inputs!).length === 0) {
      delete block.inputs
    }
  }

  private getStatementInputNames(blockId: string): string[] {
    switch (blockId) {
      case 'u_if':
        return ['BODY']
      case 'u_if_else':
        return ['THEN', 'ELSE']
      case 'u_count_loop':
      case 'u_while_loop':
      case 'u_func_def':
        return ['BODY']
      default:
        return []
    }
  }

  private getStatementBodyNode(inputName: string, node: Node): Node | null {
    switch (inputName) {
      case 'BODY':
        return node.childForFieldName('body') ?? node.childForFieldName('consequence')
      case 'THEN':
        return node.childForFieldName('consequence')
      case 'ELSE': {
        const alt = node.childForFieldName('alternative')
        if (alt?.type === 'else_clause') return alt.namedChildren[0] ?? alt
        return alt
      }
      default:
        return null
    }
  }

  private findBestMatch(specs: BlockSpec[], node: Node): BlockSpec | null {
    // Filter to specs that have astPattern
    const specsWithPattern = specs.filter(s => s.astPattern)

    // First try specs with constraints
    for (const spec of specsWithPattern) {
      if (spec.astPattern!.constraints.length > 0) {
        if (this.matchConstraints(spec, node)) {
          return spec
        }
      }
    }

    // Then try specs without constraints (generic match)
    for (const spec of specsWithPattern) {
      if (spec.astPattern!.constraints.length === 0) {
        return spec
      }
    }

    return null
  }

  private matchConstraints(spec: BlockSpec, node: Node): boolean {
    if (!spec.astPattern) return false
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
      } else if (constraint.field === 'unnamed_token' && constraint.text) {
        // Check for an unnamed child token with specific text
        let found = false
        for (const child of node.children) {
          if (!child.isNamed && child.text === constraint.text) {
            found = true
            break
          }
        }
        if (!found) return false
      } else if (constraint.field === 'leftmost_identifier' && constraint.text) {
        // Check if the leftmost identifier in a nested binary expression chain matches
        const leftmostId = this.findLeftmostIdentifier(node)
        if (leftmostId !== constraint.text) return false
      } else if (constraint.field && constraint.nodeType) {
        // Generic field + nodeType check (e.g., type: template_type)
        const fieldNode = node.childForFieldName(constraint.field)
        if (!fieldNode || fieldNode.type !== constraint.nodeType) return false
      } else if (constraint.field && constraint.text) {
        // Generic field + text check (e.g., type: "string")
        const fieldNode = node.childForFieldName(constraint.field)
        if (!fieldNode || fieldNode.text !== constraint.text) return false
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
    const placeholders = spec.codeTemplate ? this.getTemplatePlaceholders(spec.codeTemplate.pattern) : []

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
    switch (spec.astPattern?.nodeType) {
      case 'for_statement':
        return this.extractForValue(node, name)
      case 'if_statement':
        return this.extractIfValue(node, name)
      case 'function_definition':
        return this.extractFunctionDefValue(node, name)
      case 'return_statement':
        return this.extractReturnValue(node, name)
      case 'while_statement':
      case 'do_statement':
        return this.extractWhileValue(node, name)
      case 'declaration':
        return this.extractDeclarationValue(node, name)
      case 'assignment_expression':
        return this.extractAssignmentValue(node, name)
      case 'call_expression':
        return this.extractCallExprValue(spec, node, name)
      case 'binary_expression':
        if (spec.id === 'cpp_cout') return this.extractCoutCinValue(node, name, 'cout', '<<')
        if (spec.id === 'cpp_cin') return this.extractCoutCinValue(node, name, 'cin', '>>')
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
      case 'using_declaration':
        return this.extractUsingDeclValue(node, name)
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

  private extractWhileValue(node: Node, name: string): unknown {
    if (name === 'COND') {
      const cond = node.childForFieldName('condition')
      if (cond) {
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
        if (declarator?.type === 'array_declarator') {
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

  private extractUsingDeclValue(node: Node, name: string): unknown {
    if (name === 'NS') {
      // using namespace std; → the identifier child is the namespace name
      for (const child of node.namedChildren) {
        if (child.type === 'identifier') return child.text
      }
    }
    return null
  }

  private extractCoutCinValue(node: Node, name: string, _streamName: string, op: string): unknown {
    if (name === 'EXPR') {
      // Collect all values in the << or >> chain, excluding the stream name (cout/cin)
      const values = this.collectStreamValues(node, op)
      // Remove the first element (stream name like 'cout' or 'cin')
      return values.slice(1).join(` ${op} `)
    }
    return null
  }

  private collectStreamValues(node: Node, op: string): string[] {
    if (node.type !== 'binary_expression') return [node.text]
    const opNode = node.childForFieldName('operator')
    if (!opNode || opNode.text !== op) return [node.text]

    const left = node.childForFieldName('left')
    const right = node.childForFieldName('right')

    const leftValues = left ? this.collectStreamValues(left, op) : []
    const rightValues = right ? [right.text] : []

    return [...leftValues, ...rightValues]
  }

  private findLeftmostIdentifier(node: Node): string | null {
    if (node.type === 'identifier') return node.text
    if (node.type === 'qualified_identifier') {
      const name = node.childForFieldName('name')
      return name?.text ?? node.text
    }
    const left = node.childForFieldName('left')
    if (left) return this.findLeftmostIdentifier(left)
    return null
  }

  private extractAssignmentValue(node: Node, name: string): unknown {
    switch (name) {
      case 'NAME': {
        const left = node.childForFieldName('left')
        return left?.text ?? ''
      }
      case 'VALUE': {
        const right = node.childForFieldName('right')
        return right ? this.convertToExpression(right) : null
      }
      case 'OP': {
        // Find the operator token (unnamed child: =, +=, -=, etc.)
        for (const child of node.children) {
          if (!child.isNamed && /^([+\-*/%&|^]|<<|>>)?=$/.test(child.text)) {
            return child.text
          }
        }
        return '='
      }
    }
    return null
  }

  private extractStatementInputs(spec: BlockSpec, node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    // Extract body/then/else statement inputs
    const pattern = spec.codeTemplate?.pattern ?? ''

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
    switch (spec.astPattern?.nodeType) {
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
    // Try adapter first for expression blocks
    if (this.adapter) {
      const blockId = this.adapter.matchNodeToBlock(node)
      if (blockId) {
        // Check if the universal block has output connection
        const spec = this.registry.get(blockId)
        const blockDef = spec?.blockDef as Record<string, unknown> | undefined
        if (blockDef && 'output' in blockDef) {
          return this.buildBlockFromAdapter(blockId, node)
        }
        // If universal block is a statement, check if there's a language-specific expr block
      }
    }

    // Fallback: try registry (language-specific blocks)
    const specs = this.registry.getByNodeType(node.type)
    if (specs.length > 0) {
      const outputSpecs = specs.filter(s => 'output' in (s.blockDef as Record<string, unknown>))
      const spec = this.findBestMatch(outputSpecs, node) ?? this.findBestMatch(specs, node)
      if (spec) {
        const blockDef = spec.blockDef as Record<string, unknown>
        if ('output' in blockDef) {
          return this.buildBlock(spec, node)
        }
        return this.buildRawExpressionBlock(node)
      }
    }

    // For parenthesized expressions, unwrap
    if (node.type === 'parenthesized_expression' && node.namedChildren.length > 0) {
      return this.convertToExpression(node.namedChildren[0])
    }

    // Fallback: return as raw expression text
    return node.text
  }

  private buildRawExpressionBlock(node: Node): BlockJSON {
    let text = node.text
    // Strip trailing semicolon for expression context
    text = text.replace(/;\s*$/, '')
    return {
      type: 'c_raw_expression',
      id: nextBlockId(),
      fields: { CODE: text },
    }
  }

  private chainStatements(blocks: BlockJSON[]): BlockJSON[] {
    if (blocks.length <= 1) return blocks

    const topLevel: BlockJSON[] = []
    let chainTail: BlockJSON | null = null

    for (const block of blocks) {
      const hasPrev = this.blockHasConnection(block.type, 'previousStatement')
      const hasNext = this.blockHasConnection(block.type, 'nextStatement')

      if (hasPrev && chainTail) {
        // Append to current chain
        chainTail.next = { block }
        chainTail = hasNext ? block : null
      } else {
        // Standalone or start of new chain
        topLevel.push(block)
        chainTail = hasNext ? block : null
      }
    }

    return topLevel
  }

  private blockHasConnection(blockType: string, connectionName: string): boolean {
    const spec = this.registry.get(blockType)
    if (!spec) return false
    const def = spec.blockDef as Record<string, unknown>
    return connectionName in def
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

  private estimateBlockHeight(block: BlockJSON): number {
    // Estimate height for spacing top-level blocks
    let height = 50 // base height for a simple block

    // Count chained blocks (next chain)
    let current = block.next?.block
    while (current) {
      height += 40
      current = current.next?.block
    }

    // Add height for statement inputs (BODY, THEN, ELSE, etc.)
    if (block.inputs) {
      for (const input of Object.values(block.inputs)) {
        if (input.block) {
          height += this.estimateBlockHeight(input.block)
        }
      }
    }

    return height + 30 // padding between groups
  }
}
