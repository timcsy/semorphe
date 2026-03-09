import * as Blockly from 'blockly'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { DEGRADATION_VISUALS, CONFIDENCE_VISUALS } from '../theme/category-colors'
import type { BlockStylePreset } from '../../languages/style'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'

export interface BlocklyPanelOptions {
  container: HTMLElement
  toolboxXml?: string
  blockSpecRegistry?: BlockSpecRegistry
  bus?: SemanticBus
}

export class BlocklyPanel implements ViewHost {
  readonly viewId = 'blockly-panel'
  readonly viewType = 'blockly'
  readonly capabilities: ViewCapabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: ['control_flow', 'introduces_scope'],
  }

  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: (() => void) | null = null
  private onBlockSelectCallback: ((blockId: string | null) => void) | null = null
  private blockSpecRegistry: BlockSpecRegistry | null = null
  private currentRenderer: string = 'zelos'
  private bus: SemanticBus | null = null
  private busUpdateInProgress = false

  constructor(options: BlocklyPanelOptions) {
    this.container = options.container
    this.blockSpecRegistry = options.blockSpecRegistry ?? null
    this.bus = options.bus ?? null
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — actual init handled by init() method
  }

  onSemanticUpdate(event: SemanticUpdateEvent & { source?: string; blockState?: unknown }): void {
    if (event.source === 'code' && event.blockState) {
      this.busUpdateInProgress = true
      try {
        this.setState(event.blockState as object)
      } finally {
        this.busUpdateInProgress = false
      }
    }
  }

  onExecutionState(_event: ExecutionStateEvent): void {
    // BlocklyPanel doesn't handle execution state
  }

  connectBus(bus: SemanticBus): void {
    this.bus = bus
    bus.on('semantic:update', (data) => this.onSemanticUpdate(data))
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
      if (!this.busUpdateInProgress) {
        this.onChangeCallback?.()
        // Emit to bus if connected
        if (this.bus) {
          const tree = this.extractSemanticTree()
          this.bus.emit('edit:blocks', { blocklyState: { tree } })
        }
      }
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
      case 'c_for_loop': return this.extractForLoop(block)
      case 'u_break': return createNode('break', {})
      case 'u_continue': return createNode('continue', {})
      case 'u_func_def': return this.extractFuncDef(block)
      case 'u_func_call': return this.extractFuncCall(block)
      case 'u_func_call_expr': return this.extractFuncCallExpr(block)
      case 'u_return': return this.extractReturn(block)
      case 'u_print': return this.extractPrint(block)
      case 'u_input': return this.extractInput(block)
      case 'u_input_expr': return this.extractInput(block)
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
          return createNode('cpp_compound_assign', {
            name: block.getFieldValue('NAME') ?? 'x',
            operator: block.getFieldValue('OP') ?? '+=',
          }, { value: valueNode ? [valueNode] : [] })
        }
      case 'u_array_assign': {
          const arrName = block.getFieldValue('NAME') ?? 'arr'
          const idxBlock = block.getInputTargetBlock('INDEX')
          const valBlock = block.getInputTargetBlock('VALUE')
          const idxNode = idxBlock ? this.extractBlock(idxBlock) : createNode('number_literal', { value: '0' })
          const valNode = valBlock ? this.extractBlock(valBlock) : createNode('number_literal', { value: '0' })
          return createNode('array_assign', { name: arrName }, {
            index: idxNode ? [idxNode] : [],
            value: valNode ? [valNode] : [],
          })
        }
      // Expression versions of statement-only blocks
      case 'c_increment_expr': return createNode('cpp_increment_expr', {
          name: block.getFieldValue('NAME') ?? 'i',
          operator: block.getFieldValue('OP') ?? '++',
          position: block.getFieldValue('POSITION') ?? 'postfix',
        })
      case 'c_compound_assign_expr': {
          const valueBlock = block.getInputTargetBlock('VALUE')
          const valueNode = valueBlock ? this.extractBlock(valueBlock) : createNode('number_literal', { value: '1' })
          return createNode('cpp_compound_assign_expr', {
            name: block.getFieldValue('NAME') ?? 'x',
            operator: block.getFieldValue('OP') ?? '+=',
          }, { value: valueNode ? [valueNode] : [] })
        }
      case 'c_scanf_expr': return this.extractScanfExpr(block)
      case 'c_var_declare_expr': {
          const type = block.getFieldValue('TYPE') ?? 'int'
          const name = block.getFieldValue('NAME_0') ?? 'i'
          const initBlock = block.getInputTargetBlock('INIT_0')
          const initNode = initBlock ? this.extractBlock(initBlock) : null
          return createNode('var_declare_expr', { name, type }, {
            initializer: initNode ? [initNode] : [],
          })
        }
      case 'c_do_while': {
          const body = this.extractStatementInput(block, 'BODY')
          const condBlock = block.getInputTargetBlock('COND')
          const condNode = condBlock ? this.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
          return createNode('cpp_do_while', {}, {
            body,
            cond: condNode ? [condNode] : [],
          })
        }
      case 'c_ternary': {
          const condBlock = block.getInputTargetBlock('CONDITION')
          const trueBlock = block.getInputTargetBlock('TRUE_EXPR')
          const falseBlock = block.getInputTargetBlock('FALSE_EXPR')
          const condNode = condBlock ? this.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
          const trueNode = trueBlock ? this.extractBlock(trueBlock) : createNode('number_literal', { value: '0' })
          const falseNode = falseBlock ? this.extractBlock(falseBlock) : createNode('number_literal', { value: '0' })
          return createNode('cpp_ternary', {}, {
            condition: condNode ? [condNode] : [],
            true_expr: trueNode ? [trueNode] : [],
            false_expr: falseNode ? [falseNode] : [],
          })
        }
      case 'c_char_literal': return createNode('char_literal', { value: block.getFieldValue('VALUE') ?? 'a' })
      case 'c_cast': {
          const castValBlock = block.getInputTargetBlock('VALUE')
          const castValNode = castValBlock ? this.extractBlock(castValBlock) : createNode('number_literal', { value: '0' })
          return createNode('cpp_cast', { target_type: block.getFieldValue('TYPE') ?? 'int' }, {
            value: castValNode ? [castValNode] : [],
          })
        }
      case 'c_bitwise_not': {
          const bnotBlock = block.getInputTargetBlock('VALUE')
          const bnotNode = bnotBlock ? this.extractBlock(bnotBlock) : createNode('number_literal', { value: '0' })
          return createNode('bitwise_not', {}, {
            operand: bnotNode ? [bnotNode] : [],
          })
        }
      case 'c_builtin_constant':
        return createNode('builtin_constant', { value: block.getFieldValue('VALUE') ?? 'true' })
      case 'c_forward_decl': {
          const returnType = block.getFieldValue('RETURN_TYPE') ?? 'void'
          const fwdName = block.getFieldValue('NAME') ?? 'f'
          const fwdParams: string[] = []
          for (let i = 0; ; i++) {
            const paramType = block.getFieldValue(`TYPE_${i}`)
            if (paramType === null || paramType === undefined) break
            fwdParams.push(paramType)
          }
          return createNode('forward_decl', {
            return_type: returnType,
            name: fwdName,
            params: fwdParams,
          })
        }
      case 'c_raw_code': return this.extractRawCode(block)
      case 'c_raw_expression': return this.extractRawExpression(block)
      case 'c_comment_line': return this.extractComment(block)
      case 'c_comment_block': return createNode('block_comment', { text: block.getFieldValue('TEXT') ?? '' })
      case 'c_comment_doc': return this.extractDocComment(block)
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
          // Try simpleExpressionToCode for known concepts as statement
          const expr = this.simpleExpressionToCode(n)
          if (!expr.startsWith('/*')) return '    ' + expr + ';'
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
      case 'func_call':
      case 'func_call_expr': {
        const name = node.properties.name ?? 'f'
        const args = (node.children.args ?? []).map(a => this.simpleExpressionToCode(a))
        return `${name}(${args.join(', ')})`
      }
      case 'array_access': {
        const arrName = node.properties.name ?? 'arr'
        const idx = (node.children.index ?? [])[0]
        return `${arrName}[${idx ? this.simpleExpressionToCode(idx) : '0'}]`
      }
      case 'cpp_increment':
      case 'cpp_increment_expr': {
        const incName = (node.properties.name ?? 'i') as string
        const incOp = (node.properties.operator ?? '++') as string
        const incPos = (node.properties.position ?? 'postfix') as string
        return incPos === 'prefix' ? `${incOp}${incName}` : `${incName}${incOp}`
      }
      case 'cpp_ternary': {
        const cond = (node.children.condition ?? [])[0]
        const trueE = (node.children.true_expr ?? [])[0]
        const falseE = (node.children.false_expr ?? [])[0]
        return `${cond ? this.simpleExpressionToCode(cond) : '0'} ? ${trueE ? this.simpleExpressionToCode(trueE) : '0'} : ${falseE ? this.simpleExpressionToCode(falseE) : '0'}`
      }
      case 'cpp_cast': {
        const castType = node.properties.target_type ?? 'int'
        const castVal = (node.children.value ?? [])[0]
        return `(${castType})${castVal ? this.simpleExpressionToCode(castVal) : '0'}`
      }
      case 'char_literal': return `'${node.properties.value ?? 'a'}'`
      case 'builtin_constant': return String(node.properties.value ?? 'NULL')
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

    return [createNode('if', { isElseIf: 'true' }, {
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
    const inclusive = block.getFieldValue('BOUND') ?? 'FALSE'
    const fromBlock = block.getInputTargetBlock('FROM')
    const toBlock = block.getInputTargetBlock('TO')
    const from = fromBlock ? this.extractBlock(fromBlock) : createNode('number_literal', { value: '0' })
    const to = toBlock ? this.extractBlock(toBlock) : createNode('number_literal', { value: '10' })
    const body = this.extractStatementInput(block, 'BODY')
    return createNode('count_loop', { var_name: varName, inclusive }, {
      from: from ? [from] : [],
      to: to ? [to] : [],
      body,
    })
  }

  private extractForLoop(block: Blockly.Block): SemanticNode {
    const initBlock = block.getInputTargetBlock('INIT')
    const condBlock = block.getInputTargetBlock('COND')
    const updateBlock = block.getInputTargetBlock('UPDATE')
    const init = initBlock ? this.extractBlock(initBlock) : null
    const cond = condBlock ? this.extractBlock(condBlock) : null
    const update = updateBlock ? this.extractBlock(updateBlock) : null
    const body = this.extractStatementInput(block, 'BODY')
    return createNode('cpp_for_loop', {}, {
      init: init ? [init] : [],
      cond: cond ? [cond] : [],
      update: update ? [update] : [],
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
    // Legacy fallback: NAME_0, NAME_1, ... → convert to modern values format
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
    const varRefNodes = variables.map(v => createNode('var_ref', { name: v }))
    return createNode('input', {}, { values: varRefNodes })
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

  private extractScanfExpr(block: Blockly.Block): SemanticNode {
    const format = block.getFieldValue('FORMAT') ?? '%d'
    const args = this.extractThreeModeArgs(block)
    if (args.length > 0) {
      for (const arg of args) {
        if (arg.concept === 'var_ref') {
          const varName = arg.properties.name as string
          if (!this.varNeedsAddressOf(varName)) {
            arg.properties.noAddr = true
          }
        }
      }
      return createNode('cpp_scanf_expr', { format }, { args })
    }
    const argsText = block.getFieldValue('ARGS') ?? ''
    return createNode('cpp_scanf_expr', { format, args: argsText })
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
        values.push(createNode('raw_code', { code: textVal }, {}))
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

  private extractDocComment(block: Blockly.Block): SemanticNode {
    const props: Record<string, string> = {}
    props.brief = block.getFieldValue('BRIEF') ?? ''
    const extraState = (block as any).paramCount_ !== undefined
      ? { paramCount: (block as any).paramCount_, hasReturn: (block as any).hasReturn_ }
      : (block as any).saveExtraState?.() ?? {}
    const paramCount = extraState?.paramCount ?? 0
    for (let i = 0; i < paramCount; i++) {
      props[`param_${i}_name`] = block.getFieldValue(`PARAM_NAME_${i}`) ?? ''
      props[`param_${i}_desc`] = block.getFieldValue(`PARAM_DESC_${i}`) ?? ''
    }
    if (extraState?.hasReturn) {
      props.return_desc = block.getFieldValue('RETURN') ?? ''
    }
    return createNode('doc_comment', props)
  }

  private extractStatementInput(block: Blockly.Block, inputName: string): SemanticNode[] {
    const firstBlock = block.getInputTargetBlock(inputName)
    if (!firstBlock) return []
    return this.extractBlockChain(firstBlock)
  }

  onBlockSelect(callback: (blockId: string | null) => void): void {
    this.onBlockSelectCallback = callback
  }

  highlightBlock(blockId: string | null, variant: 'block-to-code' | 'code-to-block' | 'execution' = 'block-to-code'): void {
    this.clearHighlight()
    if (!blockId || !this.workspace) return
    const block = this.workspace.getBlockById(blockId)
    if (block) {
      const svgPath = (block as unknown as { pathObject?: { svgPath?: SVGElement } }).pathObject?.svgPath
        ?? block.getSvgRoot()?.querySelector('.blocklyPath')
      if (svgPath) {
        // Always remove all highlight classes first, then add the desired one
        svgPath.classList.remove('blockly-highlight-forward', 'blockly-highlight-reverse', 'blockly-highlight-execution')
        const clsMap = {
          'block-to-code': 'blockly-highlight-forward',
          'code-to-block': 'blockly-highlight-reverse',
          'execution': 'blockly-highlight-execution',
        }
        svgPath.classList.add(clsMap[variant])
      }
    }
  }

  clearHighlight(): void {
    // Remove highlight classes from ALL blocks (not just tracked one)
    if (this.workspace) {
      const svgPaths = this.workspace.getParentSvg()
        ?.querySelectorAll('.blockly-highlight-forward, .blockly-highlight-reverse, .blockly-highlight-execution')
      svgPaths?.forEach(el => {
        el.classList.remove('blockly-highlight-forward', 'blockly-highlight-reverse', 'blockly-highlight-execution')
      })
    }
  }

  /** Check if a block is visible in the current viewport */
  isBlockVisible(blockId: string): boolean {
    if (!this.workspace) return false
    const block = this.workspace.getBlockById(blockId)
    if (!block) return false
    const blockRect = block.getBoundingRectangle()
    const metrics = this.workspace.getMetrics()
    if (!metrics) return false
    // Convert block coords to viewport coords
    const scale = this.workspace.scale
    const viewLeft = metrics.viewLeft
    const viewTop = metrics.viewTop
    const viewRight = viewLeft + metrics.viewWidth
    const viewBottom = viewTop + metrics.viewHeight
    // Block rectangle is in workspace coordinates
    return blockRect.left * scale >= viewLeft &&
           blockRect.right * scale <= viewRight &&
           blockRect.top * scale >= viewTop &&
           blockRect.bottom * scale <= viewBottom
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
