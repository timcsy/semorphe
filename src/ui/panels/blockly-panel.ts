import * as Blockly from 'blockly'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { DEGRADATION_VISUALS, CONFIDENCE_VISUALS } from '../theme/category-colors'
import type { BlockStylePreset } from '../../languages/style'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'
import { BlockExtractorRegistry } from '../../core/registry/block-extractor-registry'
import type { BlockExtractContext } from '../../core/registry/block-extractor-registry'
import { createCppExtractorRegistry } from '../../languages/cpp/extractors/register'
import type { BlockMapping } from '../../core/projection/code-generator'

export interface BlocklyPanelOptions {
  container: HTMLElement
  toolboxXml?: string
  blockSpecRegistry?: BlockSpecRegistry
  bus?: SemanticBus
  media?: string
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
  private busUpdateInProgress = false
  private _blockMappings: BlockMapping[] = []
  private _blockIdToNodeId: Map<string, string> | null = null
  private media: string | undefined
  private extractorRegistry: BlockExtractorRegistry

  constructor(options: BlocklyPanelOptions) {
    this.container = options.container
    this.blockSpecRegistry = options.blockSpecRegistry ?? null
    // bus stored in options for subscription setup
    this.extractorRegistry = createCppExtractorRegistry()
    this.media = options.media
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — actual init handled by init() method
  }

  onSemanticUpdate(event: SemanticUpdateEvent & { source?: string; blockState?: unknown }): void {
    if ((event.source === 'code' || event.source === 'resync') && event.blockState) {
      this.busUpdateInProgress = true
      try {
        this.setState(event.blockState as object)
      } catch {
        // Block state may have invalid connections when code has syntax errors — safe to ignore
      } finally {
        this.busUpdateInProgress = false
      }
    }
  }

  onExecutionState(_event: ExecutionStateEvent): void {
    // BlocklyPanel doesn't handle execution state
  }

  connectBus(bus: SemanticBus): void {
    bus.on('semantic:update', (data) => this.onSemanticUpdate(data))
  }

  init(toolboxDef: object, blockStylePreset?: BlockStylePreset): void {
    const renderer = blockStylePreset?.renderer ?? 'zelos'
    this.currentRenderer = renderer

    const injectOptions: Record<string, unknown> = {
      toolbox: toolboxDef as Blockly.utils.toolbox.ToolboxDefinition,
      renderer,
      grid: { spacing: 20, length: 3, colour: '#555', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
      trashcan: true,
      theme: this.createDarkTheme(),
    }
    if (this.media) {
      injectOptions.media = this.media
    }
    this.workspace = Blockly.inject(this.container, injectOptions as Blockly.BlocklyOptions)

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
      }
    })
  }

  onChange(callback: () => void): void {
    this.onChangeCallback = callback
  }

  getWorkspace(): Blockly.WorkspaceSvg | null {
    return this.workspace
  }

  /**
   * Set a blockId→nodeId reverse map so extraction reuses original nodeIds.
   * This ensures the extracted tree's nodeIds match codeMappings/blockMappings
   * from the renderer, eliminating the need for cross-ID bridging.
   */
  setNodeIdLookup(blockIdToNodeId: Map<string, string>): void {
    this._blockIdToNodeId = blockIdToNodeId
  }

  /** Extract semantic tree from workspace blocks, plus blockMappings for nodeId↔blockId */
  extractSemanticTree(): SemanticNode {
    if (!this.workspace) return createNode('program', {}, { body: [] })
    this._blockMappings = []
    const topBlocks = this.workspace.getTopBlocks(true)
    const body: SemanticNode[] = []
    for (const block of topBlocks) {
      const nodes = this.extractBlockChain(block)
      body.push(...nodes)
    }
    return createNode('program', {}, { body })
  }

  /** Get block mappings from the last extraction */
  getBlockMappings(): BlockMapping[] {
    return this._blockMappings
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
      // Reuse original nodeId if available (preserves identity across roundtrip)
      const originalNodeId = this._blockIdToNodeId?.get(block.id)
      if (originalNodeId) {
        node.id = originalNodeId
      }
      this._blockMappings.push({ nodeId: node.id, blockId: block.id })
    }
    return node
  }

  private extractBlockInner(block: Blockly.Block): SemanticNode | null {
    const type = block.type

    const extractor = this.extractorRegistry.get(type)
    if (extractor) {
      const ctx: BlockExtractContext = {
        extractBlock: (b) => this.extractBlock(b as Blockly.Block),
        extractStatementInput: (b, name) => this.extractStatementInput(b as Blockly.Block, name),
        extractFuncArgs: (b) => this.extractFuncArgs(b as Blockly.Block),
      }
      return extractor(block, ctx)
    }

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
