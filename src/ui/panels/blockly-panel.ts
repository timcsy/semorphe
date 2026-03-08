import * as Blockly from 'blockly'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { DEGRADATION_VISUALS, CONFIDENCE_VISUALS } from '../theme/category-colors'
import type { BlockStylePreset } from '../../languages/style'

export interface BlocklyPanelOptions {
  container: HTMLElement
  toolboxXml?: string
  blockSpecRegistry?: BlockSpecRegistry
}

export class BlocklyPanel {
  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: (() => void) | null = null
  private onBlockSelectCallback: ((blockId: string | null) => void) | null = null
  private highlightedBlockId: string | null = null
  private highlightVariant: string | null = null
  private blockSpecRegistry: BlockSpecRegistry | null = null
  private currentRenderer: string = 'zelos'

  constructor(options: BlocklyPanelOptions) {
    this.container = options.container
    this.blockSpecRegistry = options.blockSpecRegistry ?? null
  }

  init(toolboxDef: object, blockStylePreset?: BlockStylePreset): void {
    const renderer = blockStylePreset?.renderer ?? 'zelos'
    this.currentRenderer = renderer

    this.workspace = Blockly.inject(this.container, {
      toolbox: toolboxDef as Blockly.utils.toolbox.ToolboxDefinition,
      renderer,
      grid: { spacing: 20, length: 3, colour: '#555', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
      trashcan: true,
      theme: this.createDarkTheme(),
    })

    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) {
        // Track block selection (click events)
        if (event.type === Blockly.Events.SELECTED) {
          const selectEvent = event as Blockly.Events.Selected
          this.onBlockSelectCallback?.(selectEvent.newElementId ?? null)
        }
        return
      }
      this.onChangeCallback?.()
    })
  }

  onChange(callback: () => void): void {
    this.onChangeCallback = callback
  }

  getWorkspace(): Blockly.WorkspaceSvg | null {
    return this.workspace
  }

  /** Extract semantic tree from workspace blocks */
  extractSemanticTree(): SemanticNode {
    if (!this.workspace) return createNode('program', {}, { body: [] })
    const topBlocks = this.workspace.getTopBlocks(true)
    const body: SemanticNode[] = []
    for (const block of topBlocks) {
      const nodes = this.extractBlockChain(block)
      body.push(...nodes)
    }
    return createNode('program', {}, { body })
  }

  private extractBlockChain(block: Blockly.Block): SemanticNode[] {
    const nodes: SemanticNode[] = []
    let current: Blockly.Block | null = block
    while (current) {
      const node = this.extractBlock(current)
      if (node) nodes.push(node)
      current = current.getNextBlock()
    }
    return nodes
  }

  private extractBlock(block: Blockly.Block): SemanticNode | null {
    const node = this.extractBlockInner(block)
    if (node) {
      node.metadata = { ...node.metadata, blockId: block.id }
    }
    return node
  }

  private extractBlockInner(block: Blockly.Block): SemanticNode | null {
    const type = block.type
    switch (type) {
      case 'u_var_declare': return this.extractVarDeclare(block)
      case 'u_var_assign': return this.extractVarAssign(block)
      case 'u_var_ref': return this.extractVarRef(block)
      case 'u_number': return this.extractNumber(block)
      case 'u_string': return this.extractString(block)
      case 'u_arithmetic': return this.extractBinaryExpr(block, 'arithmetic', 'OP', 'A', 'B')
      case 'u_compare': return this.extractBinaryExpr(block, 'compare', 'OP', 'A', 'B')
      case 'u_logic': return this.extractBinaryExpr(block, 'logic', 'OP', 'A', 'B')
      case 'u_logic_not': return this.extractUnaryExpr(block, 'logic_not', 'A', 'operand')
      case 'u_negate': {
          const negOp = block.getFieldValue('OP') ?? '-'
          const negInner = block.getInputTargetBlock('VALUE')
          const negChild = negInner ? this.extractBlock(negInner) : createNode('number_literal', { value: '0' })
          return createNode('negate', { operator: negOp }, { value: negChild ? [negChild] : [] })
        }
      case 'u_if':
      case 'u_if_else': return this.extractIf(block)
      case 'u_while_loop': return this.extractWhileLoop(block)
      case 'u_count_loop': return this.extractCountLoop(block)
      case 'u_break': return createNode('break', {})
      case 'u_continue': return createNode('continue', {})
      case 'u_func_def': return this.extractFuncDef(block)
      case 'u_func_call': return this.extractFuncCall(block)
      case 'u_func_call_expr': return this.extractFuncCallExpr(block)
      case 'u_return': return this.extractReturn(block)
      case 'u_print': return this.extractPrint(block)
      case 'u_input': return this.extractInput(block)
      case 'c_printf': return this.extractPrintf(block)
      case 'c_scanf': return this.extractScanf(block)
      case 'u_endl': return createNode('endl', {})
      case 'u_array_declare': return this.extractArrayDeclare(block)
      case 'u_array_access': return this.extractArrayAccess(block)
      case 'c_increment': return createNode('cpp_increment', {
          name: block.getFieldValue('NAME') ?? 'i',
          operator: block.getFieldValue('OP') ?? '++',
          position: block.getFieldValue('POSITION') ?? 'postfix',
        })
      case 'c_compound_assign': {
          const valueBlock = block.getInputTargetBlock('VALUE')
          const valueNode = valueBlock ? this.extractBlock(valueBlock) : createNode('number_literal', { value: '1' })
          return createNode('compound_assign', {
            name: block.getFieldValue('NAME') ?? 'x',
            operator: block.getFieldValue('OP') ?? '+=',
          }, { value: valueNode ? [valueNode] : [] })
        }
      case 'c_raw_code': return this.extractRawCode(block)
      case 'c_raw_expression': return this.extractRawExpression(block)
      case 'c_comment_line': return this.extractComment(block)
      case 'c_include': return createNode('cpp_include', { header: block.getFieldValue('HEADER') ?? 'iostream', local: false })
      case 'c_include_local': return createNode('cpp_include_local', { header: block.getFieldValue('HEADER') ?? 'myheader.h' })
      case 'c_using_namespace': return createNode('cpp_using_namespace', { namespace: block.getFieldValue('NS') ?? 'std' })
      case 'c_define': return createNode('cpp_define', { name: block.getFieldValue('NAME') ?? 'MACRO', value: block.getFieldValue('VALUE') ?? '' })
      default: {
          // P3: Open extension — use codeTemplate from JSON spec as fallback
          const generated = this.generateFromTemplate(block)
          if (generated !== null) {
            const node = createNode('raw_code', { code: generated })
            node.metadata = { rawCode: generated }
            return node
          }
          const node = createNode('raw_code', {})
          node.metadata = { rawCode: `/* unknown: ${type} */` }
          return node
        }
    }
  }

  /**
   * Generate code directly from a block's JSON codeTemplate spec.
   * Substitutes ${FIELD} placeholders with field values and
   * connected block expressions with recursively generated code.
   */
  private generateFromTemplate(block: Blockly.Block): string | null {
    if (!this.blockSpecRegistry) return null
    const specs = this.blockSpecRegistry.getAll()
    const spec = specs.find((s: BlockSpec) => s.blockDef?.type === block.type)
    if (!spec?.codeTemplate?.pattern) return null

    let code = spec.codeTemplate.pattern

    // Substitute placeholders with field values or connected block expressions
    code = code.replace(/\$\{(\w+)\}/g, (_match: string, fieldName: string) => {
      // Try field value first (FieldDropdown, FieldTextInput, etc.)
      const fieldVal = block.getFieldValue(fieldName)
      if (fieldVal !== null && fieldVal !== undefined) return String(fieldVal)

      // Try connected value input (input_value)
      const inputBlock = block.getInputTargetBlock(fieldName)
      if (inputBlock) {
        // Recursively extract and generate a simple expression
        const innerNode = this.extractBlock(inputBlock)
        if (innerNode) {
          return this.simpleExpressionToCode(innerNode)
        }
      }

      // Try statement input (input_statement) — generate body
      const stmtBody = this.extractStatementInput(block, fieldName)
      if (stmtBody.length > 0) {
        return stmtBody.map(n => {
          const raw = n.metadata?.rawCode
          if (raw) return '    ' + raw
          return `    /* ${n.concept} */`
        }).join('\n')
      }

      return fieldName
    })

    return code
  }

  /** Convert a simple semantic node to inline code string */
  private simpleExpressionToCode(node: SemanticNode): string {
    switch (node.concept) {
      case 'number_literal': return String(node.properties.value ?? '0')
      case 'string_literal': return `"${node.properties.value ?? ''}"`
      case 'var_ref': return String(node.properties.name ?? '')
      case 'arithmetic':
      case 'compare':
      case 'logic': {
        const left = (node.children.left ?? [])[0]
        const right = (node.children.right ?? [])[0]
        const op = node.properties.operator ?? '+'
        const l = left ? this.simpleExpressionToCode(left) : '0'
        const r = right ? this.simpleExpressionToCode(right) : '0'
        return `${l} ${op} ${r}`
      }
      case 'logic_not': {
        const inner = (node.children.operand ?? [])[0]
        return `!${inner ? this.simpleExpressionToCode(inner) : '0'}`
      }
      case 'negate': {
        const negOp = (node.properties.operator as string) ?? '-'
        const inner = (node.children.value ?? [])[0]
        return `${negOp}${inner ? this.simpleExpressionToCode(inner) : '0'}`
      }
      case 'raw_code': return node.metadata?.rawCode ?? ''
      case 'func_call': {
        const name = node.properties.name ?? 'f'
        const args = (node.children.args ?? []).map(a => this.simpleExpressionToCode(a))
        return `${name}(${args.join(', ')})`
      }
      default: return node.metadata?.rawCode ?? `/* ${node.concept} */`
    }
  }

  /** Extract all declarators from a multi-variable block */
  private extractVarDeclare(block: Blockly.Block): SemanticNode {
    const type = block.getFieldValue('TYPE') ?? 'int'
    const declarators: SemanticNode[] = []

    // Try indexed fields (NAME_0, NAME_1, ...)
    let i = 0
    while (true) {
      const name = block.getFieldValue(`NAME_${i}`)
      if (name === null || name === undefined) break
      const initBlock = block.getInputTargetBlock(`INIT_${i}`)
      const initNode = initBlock ? this.extractBlock(initBlock) : null
      declarators.push(createNode('var_declarator', { name }, {
        initializer: initNode ? [initNode] : [],
      }))
      i++
    }

    if (declarators.length > 1) {
      // Multi-variable: single var_declare with declarators children
      return createNode('var_declare', { type }, { declarators })
    }

    // Single variable (or fallback)
    const name = declarators.length === 1
      ? declarators[0].properties.name
      : (block.getFieldValue('NAME') ?? 'x')
    const initChildren = declarators.length === 1
      ? declarators[0].children.initializer ?? []
      : (() => {
          const initBlock = block.getInputTargetBlock('INIT') ?? block.getInputTargetBlock('INIT_0')
          const initNode = initBlock ? this.extractBlock(initBlock) : null
          return initNode ? [initNode] : []
        })()
    return createNode('var_declare', { name, type }, {
      initializer: initChildren,
    })
  }

  private extractVarAssign(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'x'
    const valueBlock = block.getInputTargetBlock('VALUE')
    const valueNode = valueBlock ? this.extractBlock(valueBlock) : null
    return createNode('var_assign', { name }, {
      value: valueNode ? [valueNode] : [],
    })
  }

  private extractVarRef(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'x'
    return createNode('var_ref', { name })
  }

  private extractNumber(block: Blockly.Block): SemanticNode {
    const value = String(block.getFieldValue('NUM') ?? 0)
    return createNode('number_literal', { value })
  }

  private extractString(block: Blockly.Block): SemanticNode {
    const value = block.getFieldValue('TEXT') ?? ''
    return createNode('string_literal', { value })
  }

  private extractBinaryExpr(
    block: Blockly.Block,
    concept: string,
    opField: string,
    leftInput: string,
    rightInput: string,
  ): SemanticNode {
    const op = this.mapOperator(block.getFieldValue(opField) ?? '+')
    const leftBlock = block.getInputTargetBlock(leftInput)
    const rightBlock = block.getInputTargetBlock(rightInput)
    const left = leftBlock ? this.extractBlock(leftBlock) : createNode('number_literal', { value: '0' })
    const right = rightBlock ? this.extractBlock(rightBlock) : createNode('number_literal', { value: '0' })
    return createNode(concept, { operator: op }, {
      left: left ? [left] : [],
      right: right ? [right] : [],
    })
  }

  private mapOperator(op: string): string {
    const map: Record<string, string> = {
      'ADD': '+', 'SUB': '-', 'MUL': '*', 'DIV': '/', 'MOD': '%',
      'EQ': '==', 'NEQ': '!=', 'LT': '<', 'GT': '>', 'LTE': '<=', 'GTE': '>=',
      'AND': '&&', 'OR': '||',
    }
    return map[op] ?? op
  }

  private extractUnaryExpr(
    block: Blockly.Block,
    concept: string,
    inputName: string,
    childName: string,
  ): SemanticNode {
    const innerBlock = block.getInputTargetBlock(inputName)
    const inner = innerBlock ? this.extractBlock(innerBlock) : createNode('number_literal', { value: '0' })
    return createNode(concept, {}, {
      [childName]: inner ? [inner] : [],
    })
  }

  private extractIf(block: Blockly.Block): SemanticNode {
    const condBlock = block.getInputTargetBlock('CONDITION')
    const cond = condBlock ? this.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })

    const thenBody = this.extractStatementInput(block, 'THEN')

    // Build else-if chain (mutator-based u_if_else) using bottom-up nesting
    let elseBody: SemanticNode[] = []
    if (this.countElseIfs(block) > 0) {
      elseBody = this.buildElseIfChain(block, 0)
    } else {
      elseBody = this.extractStatementInput(block, 'ELSE')
    }

    return createNode('if', {}, {
      condition: cond ? [cond] : [],
      then_body: thenBody,
      else_body: elseBody,
    })
  }

  private countElseIfs(block: Blockly.Block): number {
    let count = 0
    while (block.getInput(`ELSEIF_CONDITION_${count}`)) count++
    return count
  }

  private buildElseIfChain(block: Blockly.Block, index: number): SemanticNode[] {
    const total = this.countElseIfs(block)
    if (index >= total) {
      return this.extractStatementInput(block, 'ELSE')
    }

    const condBlock = block.getInputTargetBlock(`ELSEIF_CONDITION_${index}`)
    const cond = condBlock ? this.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
    const thenBody = this.extractStatementInput(block, `ELSEIF_THEN_${index}`)
    const elseBody = this.buildElseIfChain(block, index + 1)

    return [createNode('if', {}, {
      condition: cond ? [cond] : [],
      then_body: thenBody,
      else_body: elseBody,
    })]
  }

  private extractWhileLoop(block: Blockly.Block): SemanticNode {
    const condBlock = block.getInputTargetBlock('CONDITION')
    const cond = condBlock ? this.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
    const body = this.extractStatementInput(block, 'BODY')
    return createNode('while_loop', {}, {
      condition: cond ? [cond] : [],
      body,
    })
  }

  private extractCountLoop(block: Blockly.Block): SemanticNode {
    const varName = block.getFieldValue('VAR') ?? 'i'
    const fromBlock = block.getInputTargetBlock('FROM')
    const toBlock = block.getInputTargetBlock('TO')
    const from = fromBlock ? this.extractBlock(fromBlock) : createNode('number_literal', { value: '0' })
    const to = toBlock ? this.extractBlock(toBlock) : createNode('number_literal', { value: '10' })
    const body = this.extractStatementInput(block, 'BODY')
    return createNode('count_loop', { var_name: varName }, {
      from: from ? [from] : [],
      to: to ? [to] : [],
      body,
    })
  }

  private extractFuncDef(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'f'
    const returnType = block.getFieldValue('RETURN_TYPE') ?? 'void'

    // Extract params (TYPE_0/PARAM_0, TYPE_1/PARAM_1, ...)
    const params: string[] = []
    let i = 0
    while (true) {
      const paramType = block.getFieldValue(`TYPE_${i}`)
      const paramName = block.getFieldValue(`PARAM_${i}`)
      if (paramType === null && paramName === null) break
      params.push(`${paramType ?? 'int'} ${paramName ?? `p${i}`}`)
      i++
    }

    const body = this.extractStatementInput(block, 'BODY')
    return createNode('func_def', { name, return_type: returnType, params }, { body })
  }

  private extractFuncCall(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'f'
    const args = this.extractFuncArgs(block)
    return createNode('func_call', { name }, { args })
  }

  private extractFuncCallExpr(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'f'
    const args = this.extractFuncArgs(block)
    return createNode('func_call_expr', { name }, { args })
  }

  private extractFuncArgs(block: Blockly.Block): SemanticNode[] {
    const args: SemanticNode[] = []
    let i = 0
    while (true) {
      const argBlock = block.getInputTargetBlock(`ARG_${i}`) ?? block.getInputTargetBlock(`ARG${i}`)
      if (!argBlock) break
      const argNode = this.extractBlock(argBlock)
      if (argNode) args.push(argNode)
      i++
    }
    return args
  }

  private extractReturn(block: Blockly.Block): SemanticNode {
    const valueBlock = block.getInputTargetBlock('VALUE')
    const valueNode = valueBlock ? this.extractBlock(valueBlock) : null
    return createNode('return', {}, {
      value: valueNode ? [valueNode] : [],
    })
  }

  private extractPrint(block: Blockly.Block): SemanticNode {
    const values: SemanticNode[] = []
    // Dynamic expressions: EXPR0, EXPR1, ...
    let i = 0
    while (true) {
      const exprBlock = block.getInputTargetBlock(`EXPR${i}`) ?? block.getInputTargetBlock(`EXPR_${i}`)
      if (!exprBlock) break
      const node = this.extractBlock(exprBlock)
      if (node) values.push(node)
      i++
    }
    // Fallback: single EXPR
    if (values.length === 0) {
      const exprBlock = block.getInputTargetBlock('EXPR')
      if (exprBlock) {
        const node = this.extractBlock(exprBlock)
        if (node) values.push(node)
      }
    }
    return createNode('print', {}, { values })
  }

  private extractInput(block: Blockly.Block): SemanticNode {
    const values = this.extractThreeModeArgs(block)
    if (values.length > 0) {
      return createNode('input', {}, { values })
    }
    // Legacy fallback: NAME_0, NAME_1, ...
    const variables: string[] = []
    let i = 0
    while (true) {
      const name = block.getFieldValue(`NAME_${i}`)
      if (name === null || name === undefined) break
      variables.push(name)
      i++
    }
    if (variables.length === 0) {
      variables.push(block.getFieldValue('NAME') ?? 'x')
    }
    return createNode('input', {
      variable: variables[0],
      variables: variables.length > 1 ? variables : undefined,
    })
  }

  private extractPrintf(block: Blockly.Block): SemanticNode {
    const format = block.getFieldValue('FORMAT') ?? '%d\\n'
    const args = this.extractThreeModeArgs(block)
    if (args.length > 0) {
      return createNode('cpp_printf', { format }, { args })
    }
    // Legacy fallback
    const argsText = block.getFieldValue('ARGS') ?? ''
    return createNode('cpp_printf', { format, args: argsText })
  }

  private extractScanf(block: Blockly.Block): SemanticNode {
    const format = block.getFieldValue('FORMAT') ?? '%d'
    const args = this.extractThreeModeArgs(block)
    if (args.length > 0) {
      // Mark var_ref args that don't need & (arrays, strings, pointers)
      for (const arg of args) {
        if (arg.concept === 'var_ref') {
          const varName = arg.properties.name as string
          if (!this.varNeedsAddressOf(varName)) {
            arg.properties.noAddr = true
          }
        }
      }
      return createNode('cpp_scanf', { format }, { args })
    }
    // Legacy fallback
    const argsText = block.getFieldValue('ARGS') ?? ''
    return createNode('cpp_scanf', { format, args: argsText })
  }

  /** Check if a variable needs & for scanf (basic types need it, arrays/strings/pointers don't) */
  private varNeedsAddressOf(name: string): boolean {
    const workspace = this.getWorkspace()
    if (!workspace) return true  // default: assume needs &
    const noAddrTypes = new Set(['string', 'char*', 'int*', 'float*', 'double*', 'void*'])
    for (const block of workspace.getAllBlocks(false)) {
      if (block.type === 'u_array_declare' && block.getFieldValue('NAME') === name) {
        return false  // arrays don't need &
      }
      if (block.type === 'u_var_declare') {
        // Scan indexed NAME fields
        for (let i = 0; ; i++) {
          const n = block.getFieldValue(`NAME_${i}`)
          if (n === null || n === undefined) break
          if (n === name) {
            const type = block.getFieldValue('TYPE') ?? 'int'
            if (noAddrTypes.has(type)) return false
            return true
          }
        }
      }
    }
    return true
  }

  /** Extract three-mode arg slots (SEL_i / VALUE input ARG_i / TEXT_i) */
  private extractThreeModeArgs(block: Blockly.Block): SemanticNode[] {
    const values: SemanticNode[] = []
    for (let i = 0; ; i++) {
      // Mode 1: select — dropdown value in SEL_i
      const selVal = block.getFieldValue(`SEL_${i}`)
      if (selVal !== null && selVal !== undefined) {
        values.push(createNode('var_ref', { name: selVal }))
        continue
      }
      // Mode 2: compose — connected block in ARG_i value input
      const argBlock = block.getInputTargetBlock(`ARG_${i}`)
      if (argBlock) {
        const node = this.extractBlock(argBlock)
        if (node) values.push(node)
        continue
      }
      // Mode 3: custom text in TEXT_i
      const textVal = block.getFieldValue(`TEXT_${i}`)
      if (textVal !== null && textVal !== undefined) {
        values.push(createNode('raw_code', { code: textVal }, {}, { rawCode: textVal }))
        continue
      }
      // Check if there's an ARG_i input at all (compose mode, empty socket)
      if (block.getInput(`ARG_${i}`)) {
        values.push(createNode('var_ref', { name: 'x' }))
        continue
      }
      break
    }
    return values
  }

  private extractArrayDeclare(block: Blockly.Block): SemanticNode {
    const type = block.getFieldValue('TYPE') ?? 'int'
    const name = block.getFieldValue('NAME') ?? 'arr'
    const sizeBlock = block.getInputTargetBlock('SIZE')
    const sizeNode = sizeBlock ? this.extractBlock(sizeBlock) : createNode('number_literal', { value: '10' })
    return createNode('array_declare', { type, name }, {
      size: sizeNode ? [sizeNode] : [],
    })
  }

  private extractArrayAccess(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'arr'
    const indexBlock = block.getInputTargetBlock('INDEX')
    const indexNode = indexBlock ? this.extractBlock(indexBlock) : createNode('number_literal', { value: '0' })
    return createNode('array_access', { name }, {
      index: indexNode ? [indexNode] : [],
    })
  }

  private extractRawCode(block: Blockly.Block): SemanticNode {
    const code = block.getFieldValue('CODE') ?? ''
    const node = createNode('raw_code', { code })
    node.metadata = { rawCode: code }
    return node
  }

  private extractRawExpression(block: Blockly.Block): SemanticNode {
    const code = block.getFieldValue('CODE') ?? '0'
    const node = createNode('raw_code', { code })
    node.metadata = { rawCode: code }
    return node
  }

  private extractComment(block: Blockly.Block): SemanticNode {
    const text = block.getFieldValue('TEXT') ?? ''
    return createNode('comment', { text })
  }

  private extractStatementInput(block: Blockly.Block, inputName: string): SemanticNode[] {
    const firstBlock = block.getInputTargetBlock(inputName)
    if (!firstBlock) return []
    return this.extractBlockChain(firstBlock)
  }

  onBlockSelect(callback: (blockId: string | null) => void): void {
    this.onBlockSelectCallback = callback
  }

  highlightBlock(blockId: string | null, variant: 'block-to-code' | 'code-to-block' = 'block-to-code'): void {
    this.clearHighlight()
    if (!blockId || !this.workspace) return
    const block = this.workspace.getBlockById(blockId)
    if (block) {
      const svgPath = (block as unknown as { pathObject?: { svgPath?: SVGElement } }).pathObject?.svgPath
        ?? block.getSvgRoot()?.querySelector('.blocklyPath')
      if (svgPath) {
        // Always remove both classes first, then add the desired one
        svgPath.classList.remove('blockly-highlight-forward', 'blockly-highlight-reverse')
        const cls = variant === 'code-to-block' ? 'blockly-highlight-reverse' : 'blockly-highlight-forward'
        svgPath.classList.add(cls)
      }
      this.highlightedBlockId = blockId
      this.highlightVariant = variant
    }
  }

  clearHighlight(): void {
    // Remove highlight classes from ALL blocks (not just tracked one)
    if (this.workspace) {
      const svgPaths = this.workspace.getParentSvg()
        ?.querySelectorAll('.blockly-highlight-forward, .blockly-highlight-reverse')
      svgPaths?.forEach(el => {
        el.classList.remove('blockly-highlight-forward', 'blockly-highlight-reverse')
      })
    }
    this.highlightedBlockId = null
    this.highlightVariant = null
  }

  undo(): void { this.workspace?.undo(false) }
  redo(): void { this.workspace?.undo(true) }
  clear(): void { this.workspace?.clear() }

  getState(): object {
    if (!this.workspace) return {}
    return Blockly.serialization.workspaces.save(this.workspace)
  }

  setState(state: object): void {
    if (!this.workspace) return
    Blockly.Events.disable()
    try {
      Blockly.serialization.workspaces.load(state, this.workspace)
      this.applyExtraStateVisuals()
    } finally {
      Blockly.Events.enable()
    }
  }

  /** 遍歷所有積木，根據 extraState 套用降級/confidence/annotation 視覺樣式 */
  applyExtraStateVisuals(): void {
    if (!this.workspace) return
    const allBlocks = this.workspace.getAllBlocks(false)
    for (const block of allBlocks) {
      const extra = (block as unknown as { extraState_?: Record<string, unknown> }).extraState_
        ?? (block.saveExtraState?.() as Record<string, unknown> | null)
      if (!extra) continue

      // 降級視覺
      const cause = extra.degradationCause as DegradationCause | undefined
      if (cause && DEGRADATION_VISUALS[cause]) {
        const visual = DEGRADATION_VISUALS[cause]
        if (visual.colour) {
          block.setColour(visual.colour)
        }
        const tooltipKey = visual.tooltipKey
        const tooltipText = (Blockly.Msg as Record<string, string>)[tooltipKey]
        if (tooltipText) {
          block.setTooltip(tooltipText)
        }
      }

      // Confidence 視覺
      const confidence = extra.confidence as ConfidenceLevel | undefined
      if (confidence && CONFIDENCE_VISUALS[confidence]) {
        const visual = CONFIDENCE_VISUALS[confidence]
        if (visual.tooltipKey) {
          const existing = block.getTooltip()
          const confText = (Blockly.Msg as Record<string, string>)[visual.tooltipKey] ?? ''
          if (confText) {
            block.setTooltip(existing ? `${existing}\n${confText}` : confText)
          }
        }
      }

      // Apply CSS-level border styles on SVG path elements
      const svgPath = (block as any).pathObject?.svgPath as SVGElement | undefined
      const svgRoot = (block as Blockly.BlockSvg).getSvgRoot?.()

      // Degradation borderColour takes priority
      if (cause && DEGRADATION_VISUALS[cause]) {
        const visual = DEGRADATION_VISUALS[cause]
        if (visual.borderColour && svgPath) {
          svgPath.style.stroke = visual.borderColour
          svgPath.style.strokeWidth = '3px'
        }
      }

      // Confidence visuals (only if degradation didn't set a border)
      const hasDegradationBorder = cause && DEGRADATION_VISUALS[cause]?.borderColour
      if (confidence && CONFIDENCE_VISUALS[confidence] && !hasDegradationBorder) {
        const visual = CONFIDENCE_VISUALS[confidence]
        if (svgPath) {
          if (visual.borderStyle === 'dashed') {
            svgPath.style.strokeDasharray = '8,4'
          } else if (visual.borderStyle === 'solid') {
            svgPath.style.strokeDasharray = ''
          }
          if (visual.borderColour) {
            svgPath.style.stroke = visual.borderColour
            svgPath.style.strokeWidth = '3px'
          }
        }
        if (visual.opacity < 1 && svgRoot) {
          svgRoot.style.opacity = String(visual.opacity)
        }
      }

      // Annotation 視覺
      const annotations = extra.annotations as Annotation[] | undefined
      if (annotations?.length) {
        const inlineTexts = annotations
          .filter(a => a.position === 'inline' || a.position === 'after')
          .map(a => a.text)
        if (inlineTexts.length > 0) {
          block.setCommentText(inlineTexts.join('\n'))
        }
      }
    }
  }

  /** 取得目前使用的 renderer 名稱 */
  getRenderer(): string {
    return this.currentRenderer
  }

  /** 以新的 BlockStylePreset 重建 workspace（renderer 變更時需要） */
  reinitWithPreset(toolboxDef: object, preset: BlockStylePreset): object | null {
    if (!this.workspace) return null
    // 儲存當前狀態
    const state = Blockly.serialization.workspaces.save(this.workspace)
    // 銷毀舊 workspace
    this.workspace.dispose()
    this.workspace = null
    // 以新 preset 重新初始化
    this.init(toolboxDef, preset)
    // 還原狀態
    if (state && this.workspace) {
      Blockly.Events.disable()
      try {
        Blockly.serialization.workspaces.load(state, this.workspace)
        this.applyExtraStateVisuals()
      } finally {
        Blockly.Events.enable()
      }
    }
    return state
  }

  dispose(): void {
    this.workspace?.dispose()
    this.workspace = null
  }

  private createDarkTheme(): Blockly.Theme {
    return Blockly.Theme.defineTheme('dark_scratch', {
      name: 'dark_scratch',
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#1e1e1e',
        toolboxBackgroundColour: '#252526',
        toolboxForegroundColour: '#cccccc',
        flyoutBackgroundColour: '#2d2d2d',
        flyoutForegroundColour: '#cccccc',
        flyoutOpacity: 0.9,
        scrollbarColour: '#4a4a4a',
        scrollbarOpacity: 0.7,
        insertionMarkerColour: '#fff',
        insertionMarkerOpacity: 0.3,
      },
    })
  }
}
