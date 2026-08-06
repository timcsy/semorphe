import { generateCode, isUngeneratable, UNGENERATABLE_PREFIX } from '../../core/projection/code-generator'
import type { StylePreset } from '../../core/types'
import apcsStyle from '../../languages/cpp/styles/apcs.json'
import * as Blockly from 'blockly'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { DEGRADATION_VISUALS, CONFIDENCE_VISUALS } from '../theme/category-colors'
import type { BlockStylePreset } from '../../languages/style'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'
import { PatternExtractor } from '../../core/projection/pattern-extractor'
import type { BlockState as ExtractorBlockState } from '../../core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../languages/cpp/extractors/extract-strategies'
import type { BlockMapping } from '../../core/projection/code-generator'

export interface BlocklyPanelOptions {
  container: HTMLElement
  toolboxXml?: string
  blockSpecRegistry?: BlockSpecRegistry
  bus?: SemanticBus
  media?: string
  /** 產生降級用的程式碼文字時，用哪一種語言與風格。**不得寫死**（FR-003） */
  language?: string
  style?: StylePreset
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
  private onNodeSelectCallback: ((nodeId: string | null) => void) | null = null
  private blockSpecRegistry: BlockSpecRegistry | null = null
  private currentRenderer: string = 'zelos'
  private busUpdateInProgress = false
  private _blockMappings: BlockMapping[] = []
  private _blockIdToNodeId: Map<string, string> | null = null
  private media: string | undefined
  private patternExtractor: PatternExtractor

  /**
   * 降級路徑產生程式碼時用的語言與風格。
   *
   * 有預設值是因為面板可以在語言未定時先建起來；**它不是寫死的選擇**——
   * `setCodeContext` 會覆蓋它，而應用層在建立時就會傳進來。
   */
  private codeLanguage = 'cpp'
  private codeStyle: StylePreset = apcsStyle as StylePreset

  /** 應用層推進來——與同步控制器持有的是同一組值 */
  setCodeContext(language: string, style: StylePreset): void {
    this.codeLanguage = language
    this.codeStyle = style
  }

  constructor(options: BlocklyPanelOptions) {
    this.container = options.container
    this.blockSpecRegistry = options.blockSpecRegistry ?? null
    // bus stored in options for subscription setup
    this.patternExtractor = new PatternExtractor()
    if (this.blockSpecRegistry) {
      this.patternExtractor.loadBlockSpecs(this.blockSpecRegistry.getAll())
    }
    registerCppExtractStrategies(this.patternExtractor)
    this.media = options.media
    if (options.language !== undefined) this.codeLanguage = options.language
    if (options.style !== undefined) this.codeStyle = options.style
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
      // Sync blockMappings from render result so block→nodeId lookup works
      const blockState = event.blockState as { blockMappings?: BlockMapping[] }
      if (blockState.blockMappings) {
        this._blockMappings = blockState.blockMappings
      }
      // Force render after setState — dynamic blocks may not auto-render
      this.forceRenderAllBlocks()
    }
  }

  /** Force initSvg + render on all blocks in the workspace */
  private forceRenderAllBlocks(): void {
    if (!this.workspace) return
    for (const block of this.workspace.getAllBlocks(false)) {
      block.initSvg()
      block.render()
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
          const selectedBlockId = selectEvent.newElementId ?? null
          this.onBlockSelectCallback?.(selectedBlockId)
          // Emit nodeId for decoupled highlight: blockId → nodeId via block mappings
          const nodeId = selectedBlockId ? this.getNodeIdForBlockId(selectedBlockId) : null
          this.onNodeSelectCallback?.(nodeId)
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
      // Walk the extracted subtree and collect all blockId→nodeId mappings.
      // PatternExtractor preserves block.id on each extracted node,
      // so we can traverse the tree and build mappings for all nodes at once.
      this.collectMappings(node)
    }
    return node
  }

  private extractBlockInner(block: Blockly.Block): SemanticNode | null {
    // Unified path: serialize Blockly.Block → BlockState → PatternExtractor
    // PatternExtractor checks extraction strategies first, then auto-derive + dynamicRules
    const blockState = this.serializeBlockToState(block)
    if (blockState) {
      const extracted = this.patternExtractor.extract(blockState)
      if (extracted) return extracted
    }

    // Last resort: use codeTemplate from JSON spec
    const generated = this.generateFromTemplate(block)
    if (generated !== null) {
      const node = createNode('raw_code', { code: generated })
      node.metadata = { rawCode: generated }
      return node
    }
    const node = createNode('raw_code', {})
    // 語言中立的標記——介面層不知道任何語言的註解怎麼寫
    node.metadata = { rawCode: `${UNGENERATABLE_PREFIX}unknown: ${block.type}⟩` }
    return node
  }

  /**
   * Serialize a Blockly.Block into a BlockState JSON that PatternExtractor can process.
   * This bridges live Blockly blocks to the unified extraction path.
   */
  private serializeBlockToState(block: Blockly.Block): ExtractorBlockState | null {
    try {
      const fields: Record<string, unknown> = {}
      const inputs: Record<string, { block: ExtractorBlockState }> = {}

      for (const input of block.inputList) {
        // Collect fields
        for (const field of input.fieldRow) {
          if (field.name) {
            fields[field.name] = field.getValue()
          }
        }
        // Collect connected value/statement inputs
        if (input.connection && input.connection.targetBlock()) {
          const targetBlock = input.connection.targetBlock()!
          if (input.type === 1 /* inputTypes.VALUE */) {
            const serialized = this.serializeBlockToState(targetBlock)
            if (serialized) {
              inputs[input.name] = { block: serialized }
            }
          } else if (input.type === 3 /* inputTypes.STATEMENT */) {
            // Statement inputs: serialize the chain
            const chain = this.serializeStatementChain(targetBlock)
            if (chain) {
              inputs[input.name] = { block: chain }
            }
          }
        }
      }

      const state: ExtractorBlockState = {
        type: block.type,
        id: block.id,
        fields,
        inputs,
      }

      // Include extraState if the block has it
      if (typeof (block as unknown as { saveExtraState?: () => unknown }).saveExtraState === 'function') {
        const extra = (block as unknown as { saveExtraState: () => unknown }).saveExtraState()
        if (extra) state.extraState = extra as Record<string, unknown>
      }

      return state
    } catch {
      return null
    }
  }

  /** Serialize a statement chain (block + next blocks) into linked BlockState */
  private serializeStatementChain(block: Blockly.Block): ExtractorBlockState | null {
    const state = this.serializeBlockToState(block)
    if (!state) return null
    const nextBlock = block.getNextBlock()
    if (nextBlock) {
      const nextState = this.serializeStatementChain(nextBlock)
      if (nextState) {
        state.next = { block: nextState }
      }
    }
    return state
  }

  /**
   * Collect blockId → nodeId mappings from a semantic subtree extracted by PatternExtractor.
   * PatternExtractor stores sourceBlockId in metadata (node ID remains the unique truth).
   * This method walks the tree, restores original nodeIds, and records mappings.
   */
  private collectMappings(node: SemanticNode): void {
    const blockId = node.metadata?.sourceBlockId as string | undefined
    if (blockId) {
      // Restore original nodeId if available (preserves identity across roundtrip)
      const originalNodeId = this._blockIdToNodeId?.get(blockId)
      if (originalNodeId) node.id = originalNodeId
      this._blockMappings.push({ nodeId: node.id, blockId })
    }
    // Recurse into children
    for (const children of Object.values(node.children || {})) {
      if (!Array.isArray(children)) continue
      for (const child of children) {
        this.collectMappings(child)
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
          if (!isUngeneratable(expr)) return '    ' + expr + ';'
          return `    ⟨${n.concept}⟩`
        }).join('\n')
      }

      return fieldName
    })

    return code
  }

  /**
   * 把一個語義節點轉成一行程式碼文字。
   *
   * **這裡原本有一個自己的 switch**——十幾個 `case`，涵蓋數字、變數引用、
   * 算術，以及五個 C++ 專屬概念。那是系統裡的**第二套程式碼產生器**，而
   * 核心早就有完整的一套（模板引擎 + 語言套件推進來的產生器 + 風格預設）。
   *
   * 兩套之間**沒有任何東西在檢查它們一致**。刪掉的時候發現它已經漂移了：
   * 有一個 `case 'char_literal':` 指向一個**不存在的概念**（真正的是
   * `cpp_char_literal`），永遠不會觸發，而測試一路全綠。
   *
   * 切換前後每一種節點的產出由 `tests/integration/panel-expression-parity.test.ts`
   * 逐一釘住——這條是**降級路徑**（正常抽取失敗才走到），平常跑不到，
   * 改壞了不會有人發現。
   *
   * 見 specs/060-panel-parallel-generator/
   */
  private simpleExpressionToCode(node: SemanticNode): string {
    return generateCode(node, this.codeLanguage, this.codeStyle)
  }

  private extractStatementInput(block: Blockly.Block, inputName: string): SemanticNode[] {
    const firstBlock = block.getInputTargetBlock(inputName)
    if (!firstBlock) return []
    return this.extractBlockChain(firstBlock)
  }

  onBlockSelect(callback: (blockId: string | null) => void): void {
    this.onBlockSelectCallback = callback
  }

  /** Register callback for node selection (decoupled via nodeId) */
  onNodeSelect(callback: (nodeId: string | null) => void): void {
    this.onNodeSelectCallback = callback
  }

  /** Highlight block by nodeId (decoupled API — resolves nodeId → blockId internally) */
  highlightByNodeId(nodeId: string | null, variant: 'block-to-code' | 'code-to-block' | 'execution' = 'block-to-code'): void {
    if (!nodeId) { this.clearHighlight(); return }
    // Reverse lookup: nodeId → blockId
    const blockId = this.getBlockIdForNodeId(nodeId)
    this.highlightBlock(blockId, variant)
  }

  /** Resolve nodeId → blockId from current block mappings */
  private getBlockIdForNodeId(nodeId: string): string | null {
    for (const m of this._blockMappings) {
      if (m.nodeId === nodeId) return m.blockId
    }
    return null
  }

  /** Resolve blockId → nodeId from current block mappings or lookup map */
  private getNodeIdForBlockId(blockId: string): string | null {
    // Try lookup map first (set by setNodeIdLookup)
    const fromMap = this._blockIdToNodeId?.get(blockId)
    if (fromMap) return fromMap
    // Fall back to block mappings
    for (const m of this._blockMappings) {
      if (m.blockId === blockId) return m.nodeId
    }
    return null
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

  /** Mark blocks whose concept is not in visibleConcepts as semi-transparent */
  markOutOfScopeBlocks(visibleConcepts: Set<string>): void {
    if (!this.workspace || !this.blockSpecRegistry) return
    const allBlocks = this.workspace.getAllBlocks(false)
    for (const block of allBlocks) {
      const svgRoot = (block as Blockly.BlockSvg).getSvgRoot?.()
      if (!svgRoot) continue
      const spec = this.blockSpecRegistry.getAll().find(s => s.blockDef?.type === block.type)
      const conceptId = spec?.conceptMapping?.conceptId
      // If block has no concept (unknown/custom), treat as visible
      if (!conceptId || visibleConcepts.has(conceptId)) {
        svgRoot.style.opacity = ''
        svgRoot.classList.remove('out-of-scope-block')
      } else {
        svgRoot.style.opacity = '0.35'
        svgRoot.classList.add('out-of-scope-block')
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
