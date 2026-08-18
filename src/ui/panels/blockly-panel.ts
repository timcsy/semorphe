import { generateExpressionCode, isUngeneratable, UNGENERATABLE_PREFIX } from '../../core/projection/code-generator'
import type { StylePreset } from '../../core/types'
import apcsStyle from '../../languages/cpp/styles/apcs.json'
import * as Blockly from 'blockly'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { DEGRADATION_VISUALS, CONFIDENCE_VISUALS } from '../theme/category-colors'
import { formatMessage } from '../../i18n/messages'
import type { BlockStylePreset } from '../../languages/style'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent, ExecutionAtNodeEvent, DiagnosticsEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'
import { PatternExtractor } from '../../core/projection/pattern-extractor'
import type { BlockState as ExtractorBlockState } from '../../core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../languages/cpp/extractors/extract-strategies'
import { showToast } from '../toolbar/toast'
import type { BlockMapping } from '../../core/projection/code-generator'
import { buildProgram } from '../../components/cpp/program/lift'
import { createDarkWorkspaceTheme } from '../theme/dark-workspace-theme'

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
  /**
   * 🔴 上一次從語義樹載入積木**失敗**了。
   *
   * ⚠️ 為真時工作區可能只載了一半——**不得拿它去覆蓋程式碼**。
   * 下一次成功載入會清掉它（使用者按「程式碼→積木」也會）。
   */
  private stateLoadFailed = false
  /** 上一次載入失敗的訊息——🔴 診斷指令與畫面上的提示都要用它。 */
  private lastStateError: string | null = null
  /**
   * 失敗時的呼叫堆疊。
   *
   * 🔴 **訊息說得出「什麼壞了」，說不出「在哪裡壞的」。**
   * 而這個錯誤（`Cannot read properties of undefined (reading 'indexOf')`）
   * 只在 Arduino IDE（Theia）裡發生——Chromium 用同一份檔案內容重現不出來。
   * ⚠️ 沒有堆疊就只能猜，而這一輪已經猜錯過三次。
   *
   * 🟢 webview 的 bundle **刻意不壓縮**（`vite.vscode.config.ts` 的 `minify: false`），
   * 所以這裡的函式名是讀得懂的。
   */
  private lastStateStack: string | null = null
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

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    if ((event.source === 'code' || event.source === 'resync') && event.blockState) {
      this.busUpdateInProgress = true
      // 🔴 **先存一份，失敗就還原。**
      //
      // ⚠️ `setState` 拋錯時工作區是**載到一半**的——使用者看到的是一堆
      //    灰色的空積木（2026-08-18 實測），而那個畫面說不出任何原因。
      //
      // > **一個失敗的操作如果留下它做到一半的結果，
      // > 使用者看到的不是「失敗」，是「一個他不認得的狀態」。**
      const snapshot = this.workspace
        ? Blockly.serialization.workspaces.save(this.workspace)
        : null
      try {
        this.setState(event.blockState as object)
        this.stateLoadFailed = false
        this.lastStateError = null
        this.lastStateStack = null
      } catch (err) {
        // 🔴 **這裡曾經是一個空的 `catch {}`**，註解寫「safe to ignore」。
        //
        // ⚠️ 而它一點都不安全：載到一半拋錯 → **工作區是殘的**，
        //    而下一次積木變動會把那個殘的工作區**寫回使用者的檔案**。
        //    使用者實測到 `setup()`／`loop()` 整個消失，就是這個形狀。
        //
        // > **一個被吞掉的例外，會把「失敗了」變成「成功了，只是內容比較少」。**
        //
        // 處置有兩半，缺一不可：**說出來**，以及**記住這份工作區不可信**。
        this.stateLoadFailed = true
        const culprit = this.isolateFailingBlock(event.blockState as object)
        this.lastStateError = (err instanceof Error ? `${err.name}: ${err.message}` : String(err))
          + `　｜出事的積木：${culprit}`
        this.lastStateStack = err instanceof Error && err.stack
          // 只留前 8 層——再深就是 Blockly 內部的細節，而診斷輸出要看得完。
          ? err.stack.split('\n').slice(1, 9).map((l) => l.trim()).join('\n')
          : null
        console.error('[semorphe] 積木狀態載入失敗——工作區可能是殘的，暫停「積木→程式碼」', err)
        // 🔴 **要讓使用者看得到，而不是只留在開發者工具裡。**
        //
        // ⚠️ 這個宿主（IDE 面板）裡沒有人會去開 DevTools，而症狀
        //    （灰色的空積木）本身說不出原因。
        //
        // > **一則只有開發者看得到的錯誤訊息，
        // > 在使用者那裡等於沒有訊息——他只會說「卡住了」。**
        showToast(`積木載入失敗：${this.lastStateError}`, 'error')
        // 還原到上一個好的狀態——⚠️ 還原本身也可能失敗，那就清空，
        //    因為**一片空白至少說得出「這裡沒有東西」，殘骸說不出任何事**。
        try {
          if (snapshot && this.workspace) {
            Blockly.serialization.workspaces.load(snapshot, this.workspace)
          } else {
            this.workspace?.clear()
          }
        } catch (restoreErr) {
          console.error('[semorphe] 還原上一個積木狀態也失敗了', restoreErr)
          this.workspace?.clear()
        }
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

  // ⚠️ 沒有 `connectBus` 了——`semantic:update` 由視圖登錄表統一派送。

  init(toolboxDef: object, blockStylePreset?: BlockStylePreset): void {
    const renderer = blockStylePreset?.renderer ?? 'zelos'
    this.currentRenderer = renderer

    const injectOptions: Record<string, unknown> = {
      toolbox: toolboxDef as Blockly.utils.toolbox.ToolboxDefinition,
      renderer,
      grid: { spacing: 20, length: 3, colour: '#555', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
      trashcan: true,
      theme: createDarkWorkspaceTheme(),
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

  /** 工作區是不是殘的。🔴 為真時「積木→程式碼」必須停手。 */
  get isStateStale(): boolean {
    return this.stateLoadFailed
  }

  /** 上一次載入失敗的訊息，`null` 代表沒失敗過。 */
  get stateError(): string | null {
    return this.lastStateError
  }

  /** 失敗時的呼叫堆疊（前 8 層）。🔴 診斷指令要印它——沒有它就只能猜。 */
  get stateErrorStack(): string | null {
    return this.lastStateStack
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
    if (!this.workspace) return buildProgram()
    this._blockMappings = []
    const topBlocks = this.workspace.getTopBlocks(true)
    const body: SemanticNode[] = []
    for (const block of topBlocks) {
      const nodes = this.extractBlockChain(block)
      body.push(...nodes)
    }
    return buildProgram(body)
  }

  /** Get block mappings from the last extraction */
  /**
   * **從這個節點往上 `level` 層，那個範圍涵蓋哪些語義節點。**
   *
   * 「加速」用它：使用者說「跳過這一層」，執行器就要知道**跳過哪些節點**。
   *
   * ⚠️ 在此之前這段住在 `execution-controller`，而它整段是積木的知識：
   *
   * ```ts
   * workspace.getBlockById(blockId)      // 積木
   * targetBlock.getSurroundParent()      // 積木的「包住我的那一顆」
   * block.getChildren(false)             // 積木的子樹
   * syncController.getBlockMappings()    // 再翻回 nodeId
   * ```
   *
   * **執行器為了回答一個語義問題（跳過哪些節點），走了四步積木 API。**
   *
   * > **一個用別人的座標系繞一圈才回得了家的問題，本來就該在別人家裡問。**
   *
   * ⚠️ 而「層」這個概念**在積木裡與在語義樹裡不一樣**：`getSurroundParent()`
   * 跳過表達式（value inputs），只算語句包含。所以這不是「語義樹往上 N 層」
   * ——它是**積木視圖對「層」的定義**，而使用者看到的正是積木。
   * 那是它該住在這裡的第二個理由。
   *
   * 找不到對應積木時回傳 `[該節點自己]`——與原本的行為一致（保守：只跳自己）。
   */
  nodesInAncestorScope(nodeId: string, level: number): string[] {
    const blockId = this.getBlockIdForNodeId(nodeId)
    let target = blockId ? this.workspace?.getBlockById(blockId) ?? null : null
    for (let i = 1; i < level && target; i++) {
      const parent = target.getSurroundParent()
      if (!parent) break
      target = parent
    }
    if (!target) return [nodeId]

    const blockIds = new Set<string>()
    const collect = (b: Blockly.Block): void => {
      blockIds.add(b.id)
      for (const child of b.getChildren(false)) collect(child)
    }
    collect(target)
    return this._blockMappings.filter((m) => blockIds.has(m.blockId)).map((m) => m.nodeId)
  }

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
          return `    ⟨${n.conceptId}⟩`
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
    // ⚠️ **運算式位置**——不是格式偏好，是位置（見 `generateExpressionCode` 的說明）。
    // B 項合併掉 `*_expr` 雙重身分之後，位置由呼叫端說，不再由身分編碼。
    return generateExpressionCode(node, this.codeLanguage, this.codeStyle)
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
  /**
   * 執行走到某個節點時，**這個視圖的投影是「高亮那顆積木」**。
   *
   * ⚠️ 在此之前這段住在 `execution-controller`，而且是繞路走的：
   * 執行器先跟中央對映表要 `blockId`，再呼叫 `highlightBlock(blockId)`
   * ——**而 `highlightByNodeId` 早就存在了**，它自己就會反查。
   *
   * > **一段繞路的程式碼不會報錯，它只是讓中間那一站看起來是必要的。**
   */
  /**
   * 診斷的**積木側投影**：黃色驚嘆號。
   *
   * ⚠️ **先全部清掉再畫**——診斷是「當前的全集」，不是增量。
   * 只加不清的話，修好的問題會留在畫面上，而那比沒有警告更糟。
   */
  onDiagnostics(event: DiagnosticsEvent): void {
    if (!this.workspace) return
    for (const b of this.workspace.getAllBlocks(false)) b.setWarningText(null)

    // 🔴 **同一顆積木的多則要先併起來再寫。**
    // `setWarningText` 是**後蓋前**的：`int , , ;` 產生三則診斷，
    // 逐則寫的話畫面上只剩最後一則——**三個問題只看得到一個**。
    const byBlock = new Map<string, string[]>()
    for (const d of event.diagnostics) {
      // nodeId → blockId。⚠️ 診斷可能指向**沒有積木的節點**（未來會有：
      // 來自編譯器的診斷），那時這裡什麼都不做——**而程式碼視圖仍然畫得出來**。
      const blockId = this.nodeIdToBlockId(d.nodeId)
      if (!blockId) continue
      const lines = byBlock.get(blockId)
      if (lines) lines.push(this.diagnosticMessage(d))
      else byBlock.set(blockId, [this.diagnosticMessage(d)])
    }
    for (const [blockId, lines] of byBlock) {
      this.workspace.getBlockById(blockId)?.setWarningText(lines.join('\n'))
    }
  }

  /**
   * **積木側自己把一則診斷組成訊息。**
   *
   * 積木側的收件人是初學者，所以措辭是教學的——而程式碼側刻意不一樣
   * （使用者逐字：「越像實際編譯器吐出的訊息越好……**不過積木側可以不一樣**」）。
   *
   * ⚠️ **公開是刻意的**——e2e 要能拿同一則診斷問兩個面板，
   * 確認它們給出**不同**的話。私有的話那條防線只能改測內部實作。
   *
   * ⚠️ 查不到文案時**不回規則代號**。完備性由第四十二條護欄在開發期保證，
   * 執行期需要的是一句看得懂的話，不是一個看起來像訊息的代號。
   */
  diagnosticMessage(d: DiagnosticsEvent['diagnostics'][number]): string {
    return formatMessage(`DIAG_${d.rule}_BLOCK`, d.params) ?? formatMessage('DIAG_UNKNOWN') ?? ''
  }

  /** nodeId → blockId。找不到回 `null`——**不猜**。 */
  private nodeIdToBlockId(nodeId: string): string | null {
    if (!this.workspace) return null
    // ⚠️ 兩條路都要走，而順序有意義：
    // ① 未同步的積木用自己的 blockId 當錨點（見 `app.ts` 的 `adapt`）——直接查得到
    if (this.workspace.getBlockById(nodeId)) return nodeId
    // ② 已同步的走 blockMappings（渲染時建的 nodeId ↔ blockId 對照）
    return this._blockMappings.find((m) => m.nodeId === nodeId)?.blockId ?? null
  }

  onExecutionAtNode(event: ExecutionAtNodeEvent): void {
    if (!event.nodeId) {
      this.clearHighlight()
      return
    }
    this.highlightByNodeId(event.nodeId, 'execution')
    if (event.follow) {
      const blockId = this.getBlockIdForNodeId(event.nodeId)
      if (blockId) this.workspace?.centerOnBlock(blockId)
    }
  }

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

  /**
   * 🔴 **失敗時，把「狀態裡的某處」縮小成「這一顆積木」。**
   *
   * ## 為什麼需要它
   *
   * `Blockly.serialization.workspaces.load` 拋錯時只給一個訊息
   * （實測：`TypeError: Cannot read properties of undefined (reading 'indexOf')`），
   * ⚠️ **而那句話對「是哪一顆積木害的」一個字都沒說**。
   *
   * 2026-08-18 這個缺陷**只在 Arduino IDE（Theia）出現**，Chromium 用相同的
   * 檔案內容重現不到——於是我連續猜了三個假設，三個都錯。
   *
   * > **推理的替代品不是更好的推理，是把失敗的輸入縮到最小。**
   *
   * ## 做法
   *
   * 拿一個**沒有畫布的 `Blockly.Workspace`**（序列化不需要 SVG），
   * 對狀態做遞迴下降：整棵失敗 → 試每個子樹 → 回報**仍然會失敗的最深那一顆**。
   *
   * ⚠️ 回傳 `null` 有兩種意思，而它們要分得出來：
   * **逐顆都載得起來**（＝問題在組合，不在單顆）與 **隔離本身失敗了**。
   */
  private isolateFailingBlock(state: object): string {
    interface B { type?: string; extraState?: unknown; next?: { block?: B }; inputs?: Record<string, { block?: B }> }
    const root = (state as { blocks?: { blocks?: B[] } }).blocks?.blocks
    if (!Array.isArray(root) || root.length === 0) return '（狀態裡沒有積木——問題不在單顆積木上）'

    let scratch: Blockly.Workspace
    try {
      scratch = new Blockly.Workspace()
    } catch {
      return '（隔離失敗：連一個空工作區都建不起來）'
    }

    const fails = (b: B): Error | null => {
      try {
        scratch.clear()
        Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [b] } }, scratch)
        return null
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e))
      }
    }

    /** 往下縮：只要某個孩子自己也會失敗，答案就在孩子那裡。 */
    const narrow = (b: B): B => {
      const kids: B[] = []
      if (b.next?.block) kids.push(b.next.block)
      for (const inp of Object.values(b.inputs ?? {})) if (inp?.block) kids.push(inp.block)
      for (const k of kids) if (fails(k)) return narrow(k)
      return b
    }

    for (const top of root) {
      const err = fails(top)
      if (!err) continue
      const culprit = narrow(top)
      const extra = culprit.extraState === undefined ? '' : `　extraState=${JSON.stringify(culprit.extraState)}`
      return `${culprit.type ?? '(沒有 type)'}${extra}　→ ${err.name}: ${err.message}`
    }
    // 🔴 每一顆單獨都載得起來 —— 那代表問題在【組合】，不在單顆。
    return '（逐顆都載得起來——問題在積木的組合，不在單一積木）'
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

}
