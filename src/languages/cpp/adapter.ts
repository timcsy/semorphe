import type { BlockJSON, LanguageAdapter } from '../../core/types'

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
export class CppLanguageAdapter implements LanguageAdapter {
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
}
