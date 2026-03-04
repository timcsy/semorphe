import type { BlockJSON, LanguageAdapter } from '../../core/types'
import type { ConceptId, SemanticNode } from '../../core/semantic-model'
import { createNode } from '../../core/semantic-model'
import type { NewLanguageAdapter } from '../types'

interface Node {
  type: string
  text: string
  isNamed: boolean
  namedChildren: Node[]
  children: Node[]
  childForFieldName(name: string): Node | null
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
}

const ARITHMETIC_OPS = new Set(['+', '-', '*', '/', '%'])
const COMPARE_OPS = new Set(['>', '<', '>=', '<=', '==', '!='])
const LOGIC_OPS = new Set(['&&', '||'])

/**
 * CppLanguageAdapter：負責 C++ AST 節點 ↔ 概念積木的雙向映射。
 */
export class CppLanguageAdapter implements LanguageAdapter, NewLanguageAdapter {
  /** Block ID → ConceptId 映射 */
  private static readonly BLOCK_TO_CONCEPT: Record<string, ConceptId> = {
    'u_var_declare': 'var_declare',
    'u_var_assign': 'var_assign',
    'u_var_ref': 'var_ref',
    'u_number': 'number_literal',
    'u_string': 'string_literal',
    'u_arithmetic': 'arithmetic',
    'u_compare': 'compare',
    'u_logic': 'logic',
    'u_logic_not': 'logic_not',
    'u_if': 'if',
    'u_if_else': 'if',
    'u_count_loop': 'count_loop',
    'u_while_loop': 'while_loop',
    'u_break': 'break',
    'u_continue': 'continue',
    'u_func_def': 'func_def',
    'u_func_call': 'func_call',
    'u_return': 'return',
    'u_print': 'print',
    'u_input': 'input',
    'u_endl': 'endl',
    'u_array_declare': 'array_declare',
    'u_array_access': 'array_access',
  }

  /** ConceptId → Block ID 映射（反向） */
  private static readonly CONCEPT_TO_BLOCK: Record<string, string> = {
    'var_declare': 'u_var_declare',
    'var_assign': 'u_var_assign',
    'var_ref': 'u_var_ref',
    'number_literal': 'u_number',
    'string_literal': 'u_string',
    'arithmetic': 'u_arithmetic',
    'compare': 'u_compare',
    'logic': 'u_logic',
    'logic_not': 'u_logic_not',
    'if': 'u_if',
    'count_loop': 'u_count_loop',
    'while_loop': 'u_while_loop',
    'break': 'u_break',
    'continue': 'u_continue',
    'func_def': 'u_func_def',
    'func_call': 'u_func_call',
    'return': 'u_return',
    'print': 'u_print',
    'input': 'u_input',
    'endl': 'u_endl',
    'array_declare': 'u_array_declare',
    'array_access': 'u_array_access',
  }

  /** Fallback code generators for non-universal blocks (set by CppGenerator) */
  private fallbackCodeGen: {
    statement: (block: BlockJSON, indent: number) => string
    expression: (block: BlockJSON) => string
  } | null = null

  /** Set fallback code generators for handling non-u_* blocks inside universal blocks */
  setFallbackCodeGen(fns: {
    statement: (block: BlockJSON, indent: number) => string
    expression: (block: BlockJSON) => string
  }): void {
    this.fallbackCodeGen = fns
  }

  matchNodeToBlock(rawNode: unknown): string | null {
    const node = rawNode as Node

    switch (node.type) {
      case 'for_statement':
        return this.isCountingFor(node) ? 'u_count_loop' : null  // null → fallback to C++ specific

      case 'if_statement':
        return node.childForFieldName('alternative') ? 'u_if_else' : 'u_if'

      case 'while_statement':
        return 'u_while_loop'

      case 'declaration':
        return this.isArrayDeclaration(node) ? 'u_array_declare' : 'u_var_declare'

      case 'assignment_expression':
        return 'u_var_assign'

      case 'binary_expression':
        return this.matchBinaryExpression(node)

      case 'unary_expression':
        return this.matchUnaryExpression(node)

      case 'function_definition':
        return 'u_func_def'

      case 'call_expression':
        return this.matchCallExpression(node)

      case 'return_statement':
        return 'u_return'

      case 'break_statement':
        return 'u_break'

      case 'continue_statement':
        return 'u_continue'

      case 'number_literal':
        return 'u_number'

      case 'identifier':
        return 'u_var_ref'

      case 'string_literal':
        return 'u_string'

      case 'subscript_expression':
        return 'u_array_access'

      default:
        return null  // unrecognized → converter fallback
    }
  }

  extractFields(rawNode: unknown, blockId: string): {
    fields: Record<string, unknown>
    inputs: Record<string, { block: BlockJSON }>
  } {
    const node = rawNode as Node
    const fields: Record<string, unknown> = {}
    const inputs: Record<string, { block: BlockJSON }> = {}

    switch (blockId) {
      case 'u_count_loop':
        this.extractCountLoop(node, fields, inputs)
        break
      case 'u_if':
        this.extractIf(node, inputs)
        break
      case 'u_if_else':
        this.extractIfElse(node, inputs)
        break
      case 'u_while_loop':
        this.extractWhile(node, inputs)
        break
      case 'u_var_declare':
        this.extractVarDeclare(node, fields, inputs)
        break
      case 'u_var_assign':
        this.extractVarAssign(node, fields, inputs)
        break
      case 'u_arithmetic':
      case 'u_compare':
      case 'u_logic':
        this.extractBinaryOp(node, fields, inputs)
        break
      case 'u_logic_not':
        this.extractUnaryOp(node, inputs)
        break
      case 'u_func_def':
        this.extractFuncDef(node, fields)
        break
      case 'u_func_call':
        this.extractFuncCall(node, fields, inputs)
        break
      case 'u_return':
        this.extractReturn(node, inputs)
        break
      case 'u_number':
        fields.NUM = Number(node.text) || node.text
        break
      case 'u_var_ref':
        fields.NAME = node.text
        break
      case 'u_string':
        fields.TEXT = node.text.replace(/^"|"$/g, '')
        break
      case 'u_print':
        this.extractPrint(node, fields, inputs)
        break
      case 'u_input':
        this.extractInput(node, fields)
        break
      case 'u_array_declare':
        this.extractArrayDeclare(node, fields, inputs)
        break
      case 'u_array_access':
        this.extractArrayAccess(node, fields, inputs)
        break
      case 'u_break':
      case 'u_continue':
        // no fields needed
        break
    }

    return { fields, inputs }
  }

  /** 需要的 imports（由 generateCode 收集） */
  private collectedImports: Set<string> = new Set()

  /** 取得並清空收集到的 imports */
  getAndClearImports(): string[] {
    const imports = Array.from(this.collectedImports)
    this.collectedImports.clear()
    return imports
  }

  generateCode(blockId: string, block: BlockJSON, indent: number): string {
    const prefix = '    '.repeat(indent)
    const f = (block.fields ?? {}) as Record<string, unknown>
    const i = block.inputs ?? {}

    switch (blockId) {
      case 'u_var_declare': {
        const init = i.INIT ? this.genExpr(i.INIT.block) : ''
        return init
          ? `${prefix}${f.TYPE} ${f.NAME} = ${init};`
          : `${prefix}${f.TYPE} ${f.NAME};`
      }
      case 'u_var_assign':
        return `${prefix}${f.NAME} = ${this.genExpr(i.VALUE?.block)};`
      case 'u_var_ref':
        return String(f.NAME ?? '')
      case 'u_number':
        return String(f.NUM ?? '0')
      case 'u_string':
        return `"${f.TEXT ?? ''}"`
      case 'u_arithmetic':
      case 'u_compare':
      case 'u_logic':
        return `${this.genExpr(i.A?.block)} ${f.OP} ${this.genExpr(i.B?.block)}`
      case 'u_logic_not':
        return `!${this.genExpr(i.A?.block)}`
      case 'u_if':
        return `${prefix}if (${this.genExpr(i.COND?.block)}) {\n${this.genStmts(i.BODY?.block, indent + 1)}\n${prefix}}`
      case 'u_if_else':
        return `${prefix}if (${this.genExpr(i.COND?.block)}) {\n${this.genStmts(i.THEN?.block, indent + 1)}\n${prefix}} else {\n${this.genStmts(i.ELSE?.block, indent + 1)}\n${prefix}}`
      case 'u_count_loop':
        return `${prefix}for (int ${f.VAR} = ${this.genExpr(i.FROM?.block)}; ${f.VAR} <= ${this.genExpr(i.TO?.block)}; ${f.VAR}++) {\n${this.genStmts(i.BODY?.block, indent + 1)}\n${prefix}}`
      case 'u_while_loop':
        return `${prefix}while (${this.genExpr(i.COND?.block)}) {\n${this.genStmts(i.BODY?.block, indent + 1)}\n${prefix}}`
      case 'u_break':
        return `${prefix}break;`
      case 'u_continue':
        return `${prefix}continue;`
      case 'u_func_def': {
        // Dynamic params: TYPE_0/PARAM_0, TYPE_1/PARAM_1, ...
        const params: string[] = []
        let pi = 0
        while (f[`TYPE_${pi}`] !== undefined && f[`PARAM_${pi}`] !== undefined) {
          params.push(`${f[`TYPE_${pi}`]} ${f[`PARAM_${pi}`]}`)
          pi++
        }
        // Fallback to legacy PARAMS field
        const paramStr = params.length > 0 ? params.join(', ') : (f.PARAMS as string ?? '')
        return `${prefix}${f.RETURN_TYPE} ${f.NAME}(${paramStr}) {\n${this.genStmts(i.BODY?.block, indent + 1)}\n${prefix}}`
      }
      case 'u_func_call': {
        // Dynamic args: ARG0, ARG1, ... (value inputs)
        const args: string[] = []
        let ai = 0
        while (i[`ARG${ai}`]?.block) {
          args.push(this.genExpr(i[`ARG${ai}`].block))
          ai++
        }
        // Fallback to legacy ARGS field
        const argStr = args.length > 0 ? args.join(', ') : (f.ARGS as string ?? '')
        return `${f.NAME}(${argStr})`
      }
      case 'u_return':
        return `${prefix}return ${this.genExpr(i.VALUE?.block)};`
      case 'u_print': {
        this.collectedImports.add('iostream')
        // Collect all numbered expression inputs (EXPR0, EXPR1, ...)
        const exprs: string[] = []
        let idx = 0
        while (i[`EXPR${idx}`]?.block) {
          exprs.push(this.genExpr(i[`EXPR${idx}`].block))
          idx++
        }
        // Legacy single EXPR input fallback
        if (exprs.length === 0 && i.EXPR?.block) {
          exprs.push(this.genExpr(i.EXPR.block))
        }
        return `${prefix}cout << ${exprs.join(' << ')};`
      }
      case 'u_endl':
        return 'endl'
      case 'u_input': {
        this.collectedImports.add('iostream')
        // Dynamic vars: NAME_0, NAME_1, ...
        const vars: string[] = []
        let vi = 0
        while (f[`NAME_${vi}`] !== undefined) {
          vars.push(String(f[`NAME_${vi}`]))
          vi++
        }
        // Fallback to legacy single NAME field
        const varStr = vars.length > 0 ? vars.join(' >> ') : String(f.NAME ?? '')
        return `${prefix}cin >> ${varStr};`
      }
      case 'u_array_declare': {
        const size = this.genExpr(i.SIZE?.block)
        return `${prefix}${f.TYPE} ${f.NAME}[${size}];`
      }
      case 'u_array_access':
        return `${f.ARRAY}[${this.genExpr(i.INDEX?.block)}]`
      default:
        return `${prefix}/* unknown universal block: ${blockId} */`
    }
  }

  private genExpr(block: BlockJSON | undefined): string {
    if (!block) return ''
    // For universal blocks, recursively generate code
    if (block.type.startsWith('u_')) {
      return this.generateCode(block.type, block, 0).trim()
    }
    // Delegate non-u_* blocks to generator via fallback
    if (this.fallbackCodeGen) {
      return this.fallbackCodeGen.expression(block)
    }
    // Inline fallback for when no generator is wired (e.g., tests)
    const fields = block.fields ?? {}
    if (block.type === 'c_raw_expression') return String(fields.CODE ?? '')
    if (block.type === 'c_number') return String(fields.NUM ?? '0')
    if (block.type === 'c_variable_ref') return String(fields.NAME ?? '')
    if (block.type === 'c_string_literal') return `"${fields.TEXT ?? ''}"`
    return String(fields.CODE ?? fields.NAME ?? fields.NUM ?? block.type)
  }

  private genStmts(block: BlockJSON | undefined, indent: number): string {
    if (!block) return ''
    const parts: string[] = []
    let current: BlockJSON | undefined = block
    while (current) {
      if (current.type.startsWith('u_')) {
        parts.push(this.generateCode(current.type, current, indent))
      } else if (this.fallbackCodeGen) {
        // Delegate non-u_* blocks to generator via fallback
        parts.push(this.fallbackCodeGen.statement(current, indent))
      } else {
        // No fallback available — output placeholder
        parts.push('    '.repeat(indent) + `/* ${current.type} */`)
      }
      current = current.next?.block
    }
    return parts.join('\n')
  }

  // --- matchNodeToBlock helpers ---

  private isCountingFor(node: Node): boolean {
    // A counting for-loop has: init = declaration/assignment, cond = comparison, update = increment/decrement
    const init = node.childForFieldName('initializer')
    const cond = node.childForFieldName('condition')
    const update = node.childForFieldName('update')

    if (!init || !cond || !update) return false

    // Check init is a declaration or assignment
    const initOk = init.type === 'declaration' || init.type === 'assignment_expression'

    // Check condition is a comparison
    let condOk = false
    if (cond.type === 'binary_expression') {
      const op = cond.childForFieldName('operator')
      condOk = op ? COMPARE_OPS.has(op.text) : false
    }

    // Check update is an increment/decrement (i++ or ++i or i+=1 etc.)
    const updateOk = update.type === 'update_expression' ||
      (update.type === 'assignment_expression')

    return initOk && condOk && updateOk
  }

  private isArrayDeclaration(node: Node): boolean {
    const declarator = node.childForFieldName('declarator')
    if (!declarator) return false
    if (declarator.type === 'array_declarator') return true
    if (declarator.type === 'init_declarator') {
      const inner = declarator.childForFieldName('declarator')
      return inner?.type === 'array_declarator'
    }
    return false
  }

  private matchBinaryExpression(node: Node): string | null {
    const op = node.childForFieldName('operator')
    if (!op) return null

    const opText = op.text

    // Check for cout/cin first
    if (opText === '<<') {
      const leftmost = this.findLeftmostIdentifier(node)
      if (leftmost === 'cout') return 'u_print'
    }
    if (opText === '>>') {
      const leftmost = this.findLeftmostIdentifier(node)
      if (leftmost === 'cin') return 'u_input'
    }

    if (ARITHMETIC_OPS.has(opText)) return 'u_arithmetic'
    if (COMPARE_OPS.has(opText)) return 'u_compare'
    if (LOGIC_OPS.has(opText)) return 'u_logic'

    return null
  }

  private matchUnaryExpression(node: Node): string | null {
    const op = node.childForFieldName('operator')
    if (op?.text === '!') return 'u_logic_not'
    return null
  }

  private matchCallExpression(node: Node): string | null {
    const func = node.childForFieldName('function')
    if (!func) return null

    const name = func.text
    // printf/scanf → language-specific (handled by registry fallback)
    if (name === 'printf' || name === 'scanf') return null

    return 'u_func_call'
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

  // --- extractFields helpers ---

  private extractCountLoop(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const init = node.childForFieldName('initializer')
    const cond = node.childForFieldName('condition')

    // Extract variable name from init
    if (init) {
      if (init.type === 'declaration') {
        const declarator = init.childForFieldName('declarator')
        if (declarator?.type === 'init_declarator') {
          const nameNode = declarator.childForFieldName('declarator')
          fields.VAR = nameNode?.text ?? 'i'

          // FROM value
          const value = declarator.childForFieldName('value')
          if (value) {
            inputs.FROM = { block: this.nodeToExprBlock(value) }
          }
        }
      }
    }

    // TO value from condition (e.g., i < 10 → TO = 10)
    if (cond?.type === 'binary_expression') {
      const right = cond.childForFieldName('right')
      if (right) {
        inputs.TO = { block: this.nodeToExprBlock(right) }
      }
    }
  }

  private extractIf(node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    const cond = node.childForFieldName('condition')
    if (cond) {
      const condNode = cond.type === 'parenthesized_expression' && cond.namedChildren.length > 0
        ? cond.namedChildren[0] : cond
      inputs.COND = { block: this.nodeToExprBlock(condNode) }
    }
  }

  private extractIfElse(node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    this.extractIf(node, inputs)
    // THEN and ELSE are statement inputs, extracted by converter
  }

  private extractWhile(node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    const cond = node.childForFieldName('condition')
    if (cond) {
      const condNode = cond.type === 'parenthesized_expression' && cond.namedChildren.length > 0
        ? cond.namedChildren[0] : cond
      inputs.COND = { block: this.nodeToExprBlock(condNode) }
    }
  }

  private extractVarDeclare(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const typeNode = node.childForFieldName('type')
    fields.TYPE = typeNode?.text ?? ''

    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'init_declarator') {
      const nameNode = declarator.childForFieldName('declarator')
      fields.NAME = nameNode?.text ?? ''
      fields.INIT_MODE = 'with_init'

      const value = declarator.childForFieldName('value')
      if (value) {
        inputs.INIT = { block: this.nodeToExprBlock(value) }
      }
    } else {
      fields.NAME = declarator?.text ?? ''
      fields.INIT_MODE = 'no_init'
    }
  }

  private extractVarAssign(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const left = node.childForFieldName('left')
    fields.NAME = left?.text ?? ''

    const right = node.childForFieldName('right')
    if (right) {
      inputs.VALUE = { block: this.nodeToExprBlock(right) }
    }
  }

  private extractBinaryOp(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const op = node.childForFieldName('operator')
    fields.OP = op?.text ?? ''

    const left = node.childForFieldName('left')
    if (left) {
      inputs.A = { block: this.nodeToExprBlock(left) }
    }

    const right = node.childForFieldName('right')
    if (right) {
      inputs.B = { block: this.nodeToExprBlock(right) }
    }
  }

  private extractUnaryOp(node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    const operand = node.childForFieldName('argument') ?? node.childForFieldName('operand')
    if (operand) {
      inputs.A = { block: this.nodeToExprBlock(operand) }
    }
  }

  private extractFuncDef(node: Node, fields: Record<string, unknown>): void {
    const typeNode = node.childForFieldName('type')
    fields.RETURN_TYPE = typeNode?.text ?? 'void'

    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'function_declarator') {
      const nameNode = declarator.childForFieldName('declarator')
      fields.NAME = nameNode?.text ?? ''

      const params = declarator.childForFieldName('parameters')
      if (params) {
        // Dynamic params: extract each parameter as TYPE_N/PARAM_N
        let paramIdx = 0
        for (const child of params.namedChildren) {
          if (child.type === 'parameter_declaration') {
            const pType = child.childForFieldName('type')
            const pDecl = child.childForFieldName('declarator')
            if (pType && pDecl) {
              fields[`TYPE_${paramIdx}`] = pType.text
              fields[`PARAM_${paramIdx}`] = pDecl.text
              paramIdx++
            }
          }
        }
      }
    }
  }

  private extractFuncCall(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const func = node.childForFieldName('function')
    fields.NAME = func?.text ?? ''

    const args = node.childForFieldName('arguments')
    if (args) {
      // Dynamic args: extract each argument as ARG_N value input
      let argIdx = 0
      for (const child of args.namedChildren) {
        inputs[`ARG${argIdx}`] = { block: this.nodeToExprBlock(child) }
        argIdx++
      }
    }
  }

  private extractReturn(node: Node, inputs: Record<string, { block: BlockJSON }>): void {
    for (const child of node.namedChildren) {
      if (child.type !== 'return') {
        inputs.VALUE = { block: this.nodeToExprBlock(child) }
        break
      }
    }
  }

  private extractPrint(node: Node, _fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    // cout << expr << endl → collect the stream nodes
    const nodes = this.collectStreamNodes(node, '<<')
    const exprNodes = nodes.slice(1) // remove 'cout' node

    // Set each expression as a separate numbered input (EXPR0, EXPR1, ...)
    // endl is converted to u_endl block instead of u_var_ref
    for (let idx = 0; idx < exprNodes.length; idx++) {
      const n = exprNodes[idx]
      if (n.type === 'identifier' && n.text === 'endl') {
        inputs[`EXPR${idx}`] = {
          block: { type: 'u_endl', id: `adapter_${n.startPosition.row}_${n.startPosition.column}` },
        }
      } else {
        inputs[`EXPR${idx}`] = { block: this.nodeToExprBlock(n) }
      }
    }
  }

  private extractInput(node: Node, fields: Record<string, unknown>): void {
    // cin >> a >> b >> c → extract variable names as NAME_0, NAME_1, NAME_2
    const values = this.collectStreamValues(node, '>>')
    const varParts = values.slice(1) // remove 'cin'
    for (let idx = 0; idx < varParts.length; idx++) {
      fields[`NAME_${idx}`] = varParts[idx]
    }
  }

  private extractArrayDeclare(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const typeNode = node.childForFieldName('type')
    fields.TYPE = typeNode?.text ?? ''

    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'array_declarator') {
      const nameNode = declarator.childForFieldName('declarator')
      fields.NAME = nameNode?.text ?? ''
      const size = declarator.childForFieldName('size')
      if (size) {
        inputs.SIZE = { block: this.nodeToExprBlock(size) }
      }
    }
  }

  private extractArrayAccess(node: Node, fields: Record<string, unknown>, inputs: Record<string, { block: BlockJSON }>): void {
    const arg = node.childForFieldName('argument')
    fields.ARRAY = arg?.text ?? ''

    const idx = node.childForFieldName('index')
    if (idx) {
      inputs.INDEX = { block: this.nodeToExprBlock(idx) }
    }
  }

  private collectStreamNodes(node: Node, op: string): Node[] {
    if (node.type !== 'binary_expression') return [node]
    const opNode = node.childForFieldName('operator')
    if (!opNode || opNode.text !== op) return [node]

    const left = node.childForFieldName('left')
    const right = node.childForFieldName('right')

    const leftNodes = left ? this.collectStreamNodes(left, op) : []
    const rightNodes = right ? [right] : []

    return [...leftNodes, ...rightNodes]
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

  /**
   * Convert a tree-sitter node to a minimal BlockJSON expression block.
   * This is used by extractFields when building input blocks.
   */
  private nodeToExprBlock(node: Node): BlockJSON {
    const blockId = this.matchNodeToBlock(node)
    if (blockId) {
      const { fields, inputs } = this.extractFields(node, blockId)
      const block: BlockJSON = {
        type: blockId,
        id: `adapter_${node.startPosition.row}_${node.startPosition.column}`,
      }
      if (Object.keys(fields).length > 0) block.fields = fields
      if (Object.keys(inputs).length > 0) block.inputs = inputs
      return block
    }

    // Fallback: raw expression
    return {
      type: 'c_raw_expression',
      id: `adapter_${node.startPosition.row}_${node.startPosition.column}`,
      fields: { CODE: node.text.replace(/;\s*$/, '') },
    }
  }

  // ==========================================================
  // NewLanguageAdapter: toSemanticNode / toBlockJSON / fromBlockJSON
  // ==========================================================

  /** CST 節點 → SemanticNode（T009） */
  toSemanticNode(cstNode: unknown): SemanticNode | null {
    const node = cstNode as Node
    return this.cstToSemantic(node)
  }

  /** SemanticNode → BlockJSON（T010） */
  toBlockJSON(node: SemanticNode): unknown {
    return this.semanticToBlock(node)
  }

  /** BlockJSON → SemanticNode（T011） */
  fromBlockJSON(blockJson: unknown): SemanticNode | null {
    const block = blockJson as BlockJSON
    return this.blockToSemantic(block)
  }

  // --- toSemanticNode internals ---

  private cstToSemantic(node: Node): SemanticNode | null {
    if (node.type === 'translation_unit') {
      const body = this.extractSemanticBody(node.namedChildren)
      return createNode('program', {}, { body })
    }

    if (node.type === 'expression_statement') {
      if (node.namedChildren.length > 0) {
        return this.cstToSemantic(node.namedChildren[0])
      }
      return null
    }

    // Unwrap wrapper nodes (condition_clause, parenthesized_expression)
    if (node.type === 'condition_clause' || node.type === 'parenthesized_expression') {
      const value = node.childForFieldName('value')
      if (value) return this.cstToSemantic(value)
      if (node.namedChildren.length > 0) return this.cstToSemantic(node.namedChildren[0])
      return null
    }

    if (node.type === 'preproc_include') {
      const path = node.childForFieldName('path')
      const header = path?.text?.replace(/[<>"]/g, '') ?? ''
      return createNode('cpp:include' as ConceptId, { header })
    }

    if (node.type === 'using_declaration') {
      return createNode('cpp:using_namespace' as ConceptId, { namespace: 'std' })
    }

    const blockId = this.matchNodeToBlock(node)
    if (!blockId) return null

    const concept = CppLanguageAdapter.BLOCK_TO_CONCEPT[blockId]
    if (!concept) return null

    return this.buildSemanticNode(node, blockId, concept)
  }

  private buildSemanticNode(node: Node, blockId: string, concept: ConceptId): SemanticNode {
    const props: Record<string, string | number | boolean> = {}
    const children: Record<string, SemanticNode | SemanticNode[]> = {}

    switch (concept) {
      case 'var_declare':
        this.buildSemVarDeclare(node, props, children)
        break
      case 'var_assign':
        this.buildSemVarAssign(node, props, children)
        break
      case 'var_ref':
        props.name = node.text
        break
      case 'number_literal':
        props.value = node.text
        break
      case 'string_literal':
        props.value = node.text.replace(/^"|"$/g, '')
        break
      case 'arithmetic':
      case 'compare':
      case 'logic':
        this.buildSemBinaryOp(node, props, children)
        break
      case 'logic_not':
        this.buildSemLogicNot(node, children)
        break
      case 'if':
        this.buildSemIf(node, blockId, children)
        break
      case 'count_loop':
        this.buildSemCountLoop(node, props, children)
        break
      case 'while_loop':
        this.buildSemWhileLoop(node, children)
        break
      case 'break':
      case 'continue':
      case 'endl':
        break
      case 'func_def':
        this.buildSemFuncDef(node, props, children)
        break
      case 'func_call':
        this.buildSemFuncCall(node, props, children)
        break
      case 'return':
        this.buildSemReturn(node, children)
        break
      case 'print':
        this.buildSemPrint(node, children)
        break
      case 'input':
        this.buildSemInput(node, props)
        break
      case 'array_declare':
        this.buildSemArrayDeclare(node, props)
        break
      case 'array_access':
        this.buildSemArrayAccess(node, props, children)
        break
    }

    return createNode(concept, props, children)
  }

  private buildSemVarDeclare(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const typeNode = node.childForFieldName('type')
    props.type = typeNode?.text ?? ''
    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'init_declarator') {
      const nameNode = declarator.childForFieldName('declarator')
      props.name = nameNode?.text ?? ''
      const value = declarator.childForFieldName('value')
      if (value) {
        const sem = this.cstToSemantic(value)
        if (sem) children.initializer = sem
      }
    } else {
      props.name = declarator?.text ?? ''
    }
  }

  private buildSemVarAssign(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const left = node.childForFieldName('left')
    props.name = left?.text ?? ''
    const right = node.childForFieldName('right')
    if (right) {
      const sem = this.cstToSemantic(right)
      if (sem) children.value = sem
    }
  }

  private buildSemBinaryOp(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const op = node.childForFieldName('operator')
    props.operator = op?.text ?? ''
    const left = node.childForFieldName('left')
    if (left) {
      const sem = this.cstToSemantic(left)
      if (sem) children.left = sem
    }
    const right = node.childForFieldName('right')
    if (right) {
      const sem = this.cstToSemantic(right)
      if (sem) children.right = sem
    }
  }

  private buildSemLogicNot(node: Node, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const operand = node.childForFieldName('argument') ?? node.childForFieldName('operand')
    if (operand) {
      const sem = this.cstToSemantic(operand)
      if (sem) children.operand = sem
    }
  }

  private buildSemIf(node: Node, blockId: string, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const cond = node.childForFieldName('condition')
    if (cond) {
      const condNode = cond.type === 'parenthesized_expression' && cond.namedChildren.length > 0
        ? cond.namedChildren[0] : cond
      const sem = this.cstToSemantic(condNode)
      if (sem) children.condition = sem
    }
    const consequence = node.childForFieldName('consequence')
    if (consequence?.type === 'compound_statement') {
      children.then_body = this.extractSemanticBody(consequence.namedChildren)
    }
    if (blockId === 'u_if_else') {
      const alternative = node.childForFieldName('alternative')
      if (alternative) {
        const body = alternative.namedChildren[0]
        if (body?.type === 'compound_statement') {
          children.else_body = this.extractSemanticBody(body.namedChildren)
        } else if (body) {
          const sem = this.cstToSemantic(body)
          if (sem) children.else_body = [sem]
        }
      }
    }
  }

  private buildSemCountLoop(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const init = node.childForFieldName('initializer')
    if (init?.type === 'declaration') {
      const declarator = init.childForFieldName('declarator')
      if (declarator?.type === 'init_declarator') {
        const nameNode = declarator.childForFieldName('declarator')
        props.var_name = nameNode?.text ?? 'i'
        const value = declarator.childForFieldName('value')
        if (value) {
          const sem = this.cstToSemantic(value)
          if (sem) children.from = sem
        }
      }
    }
    const cond = node.childForFieldName('condition')
    if (cond?.type === 'binary_expression') {
      const right = cond.childForFieldName('right')
      if (right) {
        const sem = this.cstToSemantic(right)
        if (sem) children.to = sem
      }
    }
    const body = node.childForFieldName('body')
    if (body?.type === 'compound_statement') {
      children.body = this.extractSemanticBody(body.namedChildren)
    }
  }

  private buildSemWhileLoop(node: Node, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const cond = node.childForFieldName('condition')
    if (cond) {
      const condNode = cond.type === 'parenthesized_expression' && cond.namedChildren.length > 0
        ? cond.namedChildren[0] : cond
      const sem = this.cstToSemantic(condNode)
      if (sem) children.condition = sem
    }
    const body = node.childForFieldName('body')
    if (body?.type === 'compound_statement') {
      children.body = this.extractSemanticBody(body.namedChildren)
    }
  }

  private buildSemFuncDef(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const typeNode = node.childForFieldName('type')
    props.return_type = typeNode?.text ?? 'void'
    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'function_declarator') {
      const nameNode = declarator.childForFieldName('declarator')
      props.name = nameNode?.text ?? ''
      const params = declarator.childForFieldName('parameters')
      if (params) {
        const paramList: { type: string; name: string }[] = []
        for (const child of params.namedChildren) {
          if (child.type === 'parameter_declaration') {
            const pType = child.childForFieldName('type')
            const pDecl = child.childForFieldName('declarator')
            if (pType && pDecl) {
              paramList.push({ type: pType.text, name: pDecl.text })
            }
          }
        }
        props.params = JSON.stringify(paramList)
      } else {
        props.params = '[]'
      }
    }
    const body = node.childForFieldName('body')
    if (body?.type === 'compound_statement') {
      children.body = this.extractSemanticBody(body.namedChildren)
    }
  }

  private buildSemFuncCall(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const func = node.childForFieldName('function')
    props.name = func?.text ?? ''
    const args = node.childForFieldName('arguments')
    if (args) {
      const argList: SemanticNode[] = []
      for (const child of args.namedChildren) {
        const sem = this.cstToSemantic(child)
        if (sem) argList.push(sem)
      }
      if (argList.length > 0) children.args = argList
    }
  }

  private buildSemReturn(node: Node, children: Record<string, SemanticNode | SemanticNode[]>): void {
    for (const child of node.namedChildren) {
      if (child.type !== 'return') {
        const sem = this.cstToSemantic(child)
        if (sem) children.value = sem
        break
      }
    }
  }

  private buildSemPrint(node: Node, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const streamNodes = this.collectStreamNodes(node, '<<')
    const exprNodes = streamNodes.slice(1) // remove 'cout'
    const values: SemanticNode[] = []
    for (const n of exprNodes) {
      if (n.type === 'identifier' && n.text === 'endl') {
        values.push(createNode('endl'))
      } else {
        const sem = this.cstToSemantic(n)
        if (sem) values.push(sem)
      }
    }
    if (values.length > 0) children.values = values
  }

  private buildSemInput(node: Node, props: Record<string, string | number | boolean>): void {
    const values = this.collectStreamValues(node, '>>')
    const varParts = values.slice(1) // remove 'cin'
    props.variable = varParts.join(',')
  }

  private buildSemArrayDeclare(node: Node, props: Record<string, string | number | boolean>): void {
    const typeNode = node.childForFieldName('type')
    props.type = typeNode?.text ?? ''
    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'array_declarator') {
      const nameNode = declarator.childForFieldName('declarator')
      props.name = nameNode?.text ?? ''
      const size = declarator.childForFieldName('size')
      props.size = size?.text ?? ''
    }
  }

  private buildSemArrayAccess(node: Node, props: Record<string, string | number | boolean>, children: Record<string, SemanticNode | SemanticNode[]>): void {
    const arg = node.childForFieldName('argument')
    props.name = arg?.text ?? ''
    const idx = node.childForFieldName('index')
    if (idx) {
      const sem = this.cstToSemantic(idx)
      if (sem) children.index = sem
    }
  }

  private extractSemanticBody(nodes: Node[]): SemanticNode[] {
    const result: SemanticNode[] = []
    for (const child of nodes) {
      if (child.type === 'comment' || child.type === ';') continue
      const sem = this.cstToSemantic(child)
      if (sem) result.push(sem)
    }
    return result
  }

  // --- toBlockJSON internals ---

  private semanticToBlock(node: SemanticNode): BlockJSON {
    const concept = node.concept
    const blockId = this.conceptToBlockId(concept, node)
    const fields: Record<string, unknown> = {}
    const inputs: Record<string, { block: BlockJSON }> = {}
    const id = node.metadata?.blockId ?? `sem_${Math.random().toString(36).slice(2, 8)}`

    switch (concept) {
      case 'var_declare':
        fields.TYPE = node.properties.type ?? ''
        fields.NAME = node.properties.name ?? ''
        fields.INIT_MODE = node.children.initializer ? 'with_init' : 'no_init'
        if (node.children.initializer && !Array.isArray(node.children.initializer)) {
          inputs.INIT = { block: this.semanticToBlock(node.children.initializer) }
        }
        break

      case 'var_assign':
        fields.NAME = node.properties.name ?? ''
        if (node.children.value && !Array.isArray(node.children.value)) {
          inputs.VALUE = { block: this.semanticToBlock(node.children.value) }
        }
        break

      case 'var_ref':
        fields.NAME = node.properties.name ?? ''
        break

      case 'number_literal':
        fields.NUM = node.properties.value ?? '0'
        break

      case 'string_literal':
        fields.TEXT = node.properties.value ?? ''
        break

      case 'arithmetic':
      case 'compare':
      case 'logic':
        fields.OP = node.properties.operator ?? ''
        if (node.children.left && !Array.isArray(node.children.left)) {
          inputs.A = { block: this.semanticToBlock(node.children.left) }
        }
        if (node.children.right && !Array.isArray(node.children.right)) {
          inputs.B = { block: this.semanticToBlock(node.children.right) }
        }
        break

      case 'logic_not':
        if (node.children.operand && !Array.isArray(node.children.operand)) {
          inputs.A = { block: this.semanticToBlock(node.children.operand) }
        }
        break

      case 'if': {
        if (node.children.condition && !Array.isArray(node.children.condition)) {
          inputs.COND = { block: this.semanticToBlock(node.children.condition) }
        }
        const hasElse = node.children.else_body &&
          (Array.isArray(node.children.else_body) ? node.children.else_body.length > 0 : true)
        if (hasElse) {
          const thenBody = Array.isArray(node.children.then_body) ? node.children.then_body : []
          if (thenBody.length > 0) {
            inputs.THEN = { block: this.semanticArrayToChain(thenBody) }
          }
          const elseBody = Array.isArray(node.children.else_body) ? node.children.else_body : []
          if (elseBody.length > 0) {
            inputs.ELSE = { block: this.semanticArrayToChain(elseBody) }
          }
        } else {
          const body = Array.isArray(node.children.then_body) ? node.children.then_body : []
          if (body.length > 0) {
            inputs.BODY = { block: this.semanticArrayToChain(body) }
          }
        }
        break
      }

      case 'count_loop':
        fields.VAR = node.properties.var_name ?? 'i'
        if (node.children.from && !Array.isArray(node.children.from)) {
          inputs.FROM = { block: this.semanticToBlock(node.children.from) }
        }
        if (node.children.to && !Array.isArray(node.children.to)) {
          inputs.TO = { block: this.semanticToBlock(node.children.to) }
        }
        if (Array.isArray(node.children.body) && node.children.body.length > 0) {
          inputs.BODY = { block: this.semanticArrayToChain(node.children.body) }
        }
        break

      case 'while_loop':
        if (node.children.condition && !Array.isArray(node.children.condition)) {
          inputs.COND = { block: this.semanticToBlock(node.children.condition) }
        }
        if (Array.isArray(node.children.body) && node.children.body.length > 0) {
          inputs.BODY = { block: this.semanticArrayToChain(node.children.body) }
        }
        break

      case 'break':
      case 'continue':
      case 'endl':
        break

      case 'func_def': {
        fields.RETURN_TYPE = node.properties.return_type ?? 'void'
        fields.NAME = node.properties.name ?? ''
        const params = typeof node.properties.params === 'string'
          ? JSON.parse(node.properties.params) as { type: string; name: string }[]
          : []
        for (let pi = 0; pi < params.length; pi++) {
          fields[`TYPE_${pi}`] = params[pi].type
          fields[`PARAM_${pi}`] = params[pi].name
        }
        if (Array.isArray(node.children.body) && node.children.body.length > 0) {
          inputs.BODY = { block: this.semanticArrayToChain(node.children.body) }
        }
        break
      }

      case 'func_call': {
        fields.NAME = node.properties.name ?? ''
        const args = Array.isArray(node.children.args) ? node.children.args : []
        for (let ai = 0; ai < args.length; ai++) {
          inputs[`ARG${ai}`] = { block: this.semanticToBlock(args[ai]) }
        }
        break
      }

      case 'return':
        if (node.children.value && !Array.isArray(node.children.value)) {
          inputs.VALUE = { block: this.semanticToBlock(node.children.value) }
        }
        break

      case 'print': {
        const values = Array.isArray(node.children.values) ? node.children.values : []
        for (let idx = 0; idx < values.length; idx++) {
          inputs[`EXPR${idx}`] = { block: this.semanticToBlock(values[idx]) }
        }
        break
      }

      case 'input': {
        const variable = String(node.properties.variable ?? '')
        const vars = variable.split(',')
        for (let vi = 0; vi < vars.length; vi++) {
          fields[`NAME_${vi}`] = vars[vi]
        }
        break
      }

      case 'array_declare':
        fields.TYPE = node.properties.type ?? ''
        fields.NAME = node.properties.name ?? ''
        if (node.properties.size !== undefined) {
          const sizeStr = String(node.properties.size)
          inputs.SIZE = { block: { type: 'u_number', id: `size_${id}`, fields: { NUM: sizeStr } } }
        }
        break

      case 'array_access':
        fields.ARRAY = node.properties.name ?? ''
        if (node.children.index && !Array.isArray(node.children.index)) {
          inputs.INDEX = { block: this.semanticToBlock(node.children.index) }
        }
        break

      default:
        // Language-specific concepts (cpp:include, etc.)
        for (const [key, val] of Object.entries(node.properties)) {
          fields[key.toUpperCase()] = val
        }
    }

    const block: BlockJSON = { type: blockId, id }
    if (Object.keys(fields).length > 0) block.fields = fields
    if (Object.keys(inputs).length > 0) block.inputs = inputs
    return block
  }

  private conceptToBlockId(concept: ConceptId, node: SemanticNode): string {
    if (concept === 'if') {
      const hasElse = node.children.else_body &&
        (Array.isArray(node.children.else_body) ? node.children.else_body.length > 0 : true)
      return hasElse ? 'u_if_else' : 'u_if'
    }
    return CppLanguageAdapter.CONCEPT_TO_BLOCK[concept] ?? concept
  }

  private semanticArrayToChain(nodes: SemanticNode[]): BlockJSON {
    const blocks = nodes.map(n => this.semanticToBlock(n))
    for (let i = 0; i < blocks.length - 1; i++) {
      blocks[i].next = { block: blocks[i + 1] }
    }
    return blocks[0]
  }

  // --- fromBlockJSON internals ---

  private blockToSemantic(block: BlockJSON): SemanticNode | null {
    const blockId = block.type
    const concept = CppLanguageAdapter.BLOCK_TO_CONCEPT[blockId]
    if (!concept) return null

    const f = (block.fields ?? {}) as Record<string, unknown>
    const i = block.inputs ?? {}
    const props: Record<string, string | number | boolean> = {}
    const children: Record<string, SemanticNode | SemanticNode[]> = {}

    switch (concept) {
      case 'var_declare':
        props.name = String(f.NAME ?? '')
        props.type = String(f.TYPE ?? '')
        if (i.INIT?.block) {
          const init = this.blockToSemantic(i.INIT.block)
          if (init) children.initializer = init
        }
        break

      case 'var_assign':
        props.name = String(f.NAME ?? '')
        if (i.VALUE?.block) {
          const val = this.blockToSemantic(i.VALUE.block)
          if (val) children.value = val
        }
        break

      case 'var_ref':
        props.name = String(f.NAME ?? '')
        break

      case 'number_literal':
        props.value = String(f.NUM ?? '0')
        break

      case 'string_literal':
        props.value = String(f.TEXT ?? '')
        break

      case 'arithmetic':
      case 'compare':
      case 'logic':
        props.operator = String(f.OP ?? '')
        if (i.A?.block) {
          const left = this.blockToSemantic(i.A.block)
          if (left) children.left = left
        }
        if (i.B?.block) {
          const right = this.blockToSemantic(i.B.block)
          if (right) children.right = right
        }
        break

      case 'logic_not':
        if (i.A?.block) {
          const operand = this.blockToSemantic(i.A.block)
          if (operand) children.operand = operand
        }
        break

      case 'if': {
        if (i.COND?.block) {
          const cond = this.blockToSemantic(i.COND.block)
          if (cond) children.condition = cond
        }
        if (blockId === 'u_if_else') {
          children.then_body = i.THEN?.block ? this.chainToArray(i.THEN.block) : []
          children.else_body = i.ELSE?.block ? this.chainToArray(i.ELSE.block) : []
        } else {
          children.then_body = i.BODY?.block ? this.chainToArray(i.BODY.block) : []
        }
        break
      }

      case 'count_loop':
        props.var_name = String(f.VAR ?? 'i')
        if (i.FROM?.block) {
          const from = this.blockToSemantic(i.FROM.block)
          if (from) children.from = from
        }
        if (i.TO?.block) {
          const to = this.blockToSemantic(i.TO.block)
          if (to) children.to = to
        }
        children.body = i.BODY?.block ? this.chainToArray(i.BODY.block) : []
        break

      case 'while_loop':
        if (i.COND?.block) {
          const cond = this.blockToSemantic(i.COND.block)
          if (cond) children.condition = cond
        }
        children.body = i.BODY?.block ? this.chainToArray(i.BODY.block) : []
        break

      case 'break':
      case 'continue':
      case 'endl':
        break

      case 'func_def': {
        props.name = String(f.NAME ?? '')
        props.return_type = String(f.RETURN_TYPE ?? 'void')
        const params: { type: string; name: string }[] = []
        let pi = 0
        while (f[`TYPE_${pi}`] !== undefined && f[`PARAM_${pi}`] !== undefined) {
          params.push({ type: String(f[`TYPE_${pi}`]), name: String(f[`PARAM_${pi}`]) })
          pi++
        }
        if (params.length === 0 && f.PARAMS) {
          props.params = String(f.PARAMS)
        } else {
          props.params = JSON.stringify(params)
        }
        children.body = i.BODY?.block ? this.chainToArray(i.BODY.block) : []
        break
      }

      case 'func_call': {
        props.name = String(f.NAME ?? '')
        const args: SemanticNode[] = []
        let ai = 0
        while (i[`ARG${ai}`]?.block) {
          const arg = this.blockToSemantic(i[`ARG${ai}`].block)
          if (arg) args.push(arg)
          ai++
        }
        if (args.length > 0) children.args = args
        break
      }

      case 'return':
        if (i.VALUE?.block) {
          const val = this.blockToSemantic(i.VALUE.block)
          if (val) children.value = val
        }
        break

      case 'print': {
        const values: SemanticNode[] = []
        let idx = 0
        while (i[`EXPR${idx}`]?.block) {
          const expr = this.blockToSemantic(i[`EXPR${idx}`].block)
          if (expr) values.push(expr)
          idx++
        }
        if (values.length === 0 && i.EXPR?.block) {
          const expr = this.blockToSemantic(i.EXPR.block)
          if (expr) values.push(expr)
        }
        if (values.length > 0) children.values = values
        break
      }

      case 'input': {
        const vars: string[] = []
        let vi = 0
        while (f[`NAME_${vi}`] !== undefined) {
          vars.push(String(f[`NAME_${vi}`]))
          vi++
        }
        if (vars.length === 0 && f.NAME) {
          props.variable = String(f.NAME)
        } else {
          props.variable = vars.join(',')
        }
        break
      }

      case 'array_declare':
        props.name = String(f.NAME ?? '')
        props.type = String(f.TYPE ?? '')
        if (i.SIZE?.block) {
          const sizeBlock = i.SIZE.block
          props.size = String(sizeBlock.fields?.NUM ?? sizeBlock.fields?.CODE ?? '')
        }
        break

      case 'array_access':
        props.name = String(f.ARRAY ?? '')
        if (i.INDEX?.block) {
          const idx = this.blockToSemantic(i.INDEX.block)
          if (idx) children.index = idx
        }
        break
    }

    return createNode(concept, props, children, { blockId: block.id })
  }

  private chainToArray(block: BlockJSON): SemanticNode[] {
    const result: SemanticNode[] = []
    let current: BlockJSON | undefined = block
    while (current) {
      const sem = this.blockToSemantic(current)
      if (sem) result.push(sem)
      current = current.next?.block
    }
    return result
  }
}
