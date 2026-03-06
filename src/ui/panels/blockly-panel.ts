import * as Blockly from 'blockly'
import type { SemanticNode } from '../../core/types'
import { createNode } from '../../core/semantic-tree'

export interface BlocklyPanelOptions {
  container: HTMLElement
  toolboxXml?: string
}

export class BlocklyPanel {
  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: (() => void) | null = null

  constructor(options: BlocklyPanelOptions) {
    this.container = options.container
  }

  init(toolboxDef: object): void {
    this.workspace = Blockly.inject(this.container, {
      toolbox: toolboxDef as Blockly.utils.toolbox.ToolboxDefinition,
      renderer: 'zelos',
      grid: { spacing: 20, length: 3, colour: '#555', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
      trashcan: true,
      theme: this.createDarkTheme(),
    })

    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return
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
      case 'u_logic_not': return this.extractUnaryExpr(block, 'logic_not', 'VALUE', 'operand')
      case 'u_negate': return this.extractUnaryExpr(block, 'negate', 'VALUE', 'value')
      case 'u_if':
      case 'u_if_else': return this.extractIf(block)
      case 'u_while_loop': return this.extractWhileLoop(block)
      case 'u_count_loop': return this.extractCountLoop(block)
      case 'u_break': return createNode('break', {})
      case 'u_continue': return createNode('continue', {})
      case 'u_func_def': return this.extractFuncDef(block)
      case 'u_func_call': return this.extractFuncCall(block)
      case 'u_return': return this.extractReturn(block)
      case 'u_print': return this.extractPrint(block)
      case 'u_input': return this.extractInput(block)
      case 'u_endl': return createNode('endl', {})
      case 'u_array_declare': return this.extractArrayDeclare(block)
      case 'u_array_access': return this.extractArrayAccess(block)
      default: {
          const node = createNode('raw_code', {})
          node.metadata = { rawCode: `/* unknown: ${type} */` }
          return node
        }
    }
  }

  private extractVarDeclare(block: Blockly.Block): SemanticNode {
    // Support multi-variable declarations (NAME_0, NAME_1, ...)
    const type = block.getFieldValue('TYPE') ?? 'int'
    // Try indexed fields first (new format)
    let i = 0
    const declarators: SemanticNode[] = []
    while (true) {
      const name = block.getFieldValue(`NAME_${i}`)
      if (name === null || name === undefined) break
      const initBlock = block.getInputTargetBlock(`INIT_${i}`)
      const initNode = initBlock ? this.extractBlock(initBlock) : null
      declarators.push(createNode('var_declare', { name, type }, {
        initializer: initNode ? [initNode] : [],
      }))
      i++
    }

    if (declarators.length > 1) {
      // Multiple vars: return as separate nodes, first one here, rest via chain
      return declarators[0]
    }

    if (declarators.length === 1) {
      return declarators[0]
    }

    // Fallback: single NAME field (old format)
    const name = block.getFieldValue('NAME') ?? block.getFieldValue('NAME_0') ?? 'x'
    const initBlock = block.getInputTargetBlock('INIT') ?? block.getInputTargetBlock('INIT_0')
    const initNode = initBlock ? this.extractBlock(initBlock) : null
    return createNode('var_declare', { name, type }, {
      initializer: initNode ? [initNode] : [],
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
    const elseBody = this.extractStatementInput(block, 'ELSE')

    return createNode('if', {}, {
      condition: cond ? [cond] : [],
      then_body: thenBody,
      else_body: elseBody,
    })
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

    // Extract params (dynamic inputs PARAM_0, PARAM_1, ...)
    const params: string[] = []
    let i = 0
    while (true) {
      const paramType = block.getFieldValue(`PARAM_TYPE_${i}`)
      const paramName = block.getFieldValue(`PARAM_NAME_${i}`)
      if (paramType === null && paramName === null) break
      params.push(`${paramType ?? 'int'} ${paramName ?? `p${i}`}`)
      i++
    }

    const body = this.extractStatementInput(block, 'BODY')
    return createNode('func_def', { name, return_type: returnType, params }, { body })
  }

  private extractFuncCall(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'f'
    const args: SemanticNode[] = []
    let i = 0
    while (true) {
      const argBlock = block.getInputTargetBlock(`ARG_${i}`) ?? block.getInputTargetBlock(`ARG${i}`)
      if (!argBlock) break
      const argNode = this.extractBlock(argBlock)
      if (argNode) args.push(argNode)
      i++
    }
    return createNode('func_call', { name }, { args })
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
    const variable = block.getFieldValue('NAME_0') ?? block.getFieldValue('NAME') ?? 'x'
    return createNode('input', { variable })
  }

  private extractArrayDeclare(block: Blockly.Block): SemanticNode {
    const type = block.getFieldValue('TYPE') ?? 'int'
    const name = block.getFieldValue('NAME') ?? 'arr'
    const size = String(block.getFieldValue('SIZE') ?? 10)
    return createNode('array_declare', { type, name, size })
  }

  private extractArrayAccess(block: Blockly.Block): SemanticNode {
    const name = block.getFieldValue('NAME') ?? 'arr'
    const indexBlock = block.getInputTargetBlock('INDEX')
    const indexNode = indexBlock ? this.extractBlock(indexBlock) : createNode('number_literal', { value: '0' })
    return createNode('array_access', { name }, {
      index: indexNode ? [indexNode] : [],
    })
  }

  private extractStatementInput(block: Blockly.Block, inputName: string): SemanticNode[] {
    const firstBlock = block.getInputTargetBlock(inputName)
    if (!firstBlock) return []
    return this.extractBlockChain(firstBlock)
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
    Blockly.serialization.workspaces.load(state, this.workspace)
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
