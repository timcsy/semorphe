import type { SemanticNode, StylePreset, Topic } from '../core/types'
import { flattenLevelTree, getVisibleConcepts } from '../core/level-tree'
import type { ProgramScaffold, ScaffoldResult } from '../core/program-scaffold'
import type { CodingStyle } from '../languages/style'
import {
  detectStyleExceptions, applyStyleConversions,
  analyzeIoConformance,
  type StyleException, type IoConformanceResult,
} from '../languages/cpp/style-exceptions'
import { generateCodeWithMapping } from '../core/projection/code-generator'

/** Convert StylePreset (core/types) → CodingStyle (languages/style) for style exception detection */
function toCodingStyle(preset: StylePreset): CodingStyle {
  return {
    id: preset.id,
    nameKey: preset.id,
    ioPreference: preset.io_style === 'printf' ? 'cstdio' : 'iostream',
    namingConvention: preset.naming_convention,
    braceStyle: preset.brace_style,
    indent: preset.indent_size,
    useNamespaceStd: preset.namespace_style === 'using',
    headerStyle: preset.header_style === 'bits' ? 'bits' : 'iostream',
  }
}
import type { CodeMapping, BlockMapping } from '../core/projection/code-generator'
import { renderToBlocklyState } from '../core/projection/block-renderer'
import { Lifter } from '../core/lift/lifter'
import { SemanticBus } from '../core/semantic-bus'
import { abstractConceptOf, variableTypeOf } from '../core/language-executors'
import { isFunctionDefinition } from '../core/component/traits'

/** Scaffold node filter type — strips scaffold nodes for L0 display */
export type ScaffoldNodeFilter = (tree: SemanticNode) => SemanticNode

/** Default no-op filter (returns tree as-is) */
function identityFilter(tree: SemanticNode): SemanticNode {
  return tree
}

export interface CodeParser {
  parse(code: string): { rootNode: unknown }
}

export class SyncController {
  private bus: SemanticBus
  private language: string
  private style: StylePreset
  private currentTree: SemanticNode | null = null

  /**
   * 被降級的節點：`nodeId → 原本的 conceptId`。
   *
   * ## ⚠️ 為什麼需要它——**閉環的系統裡，輸出端的損失會從輸入端回來**
   *
   * 2026-08-09 修過一次「降級不得就地改寫真實」：降級只作用在 `cloneTree`
   * 出來的顯示樹上，`currentTree` 保持真實。**那個修法只顧了 code→blocks。**
   *
   * 而 blocks→code 那個方向的樹是**從積木抽回來的**，
   * 而積木畫的就是降級後的樣子：
   *
   * ```
   * vector<int> v;  →  cpp:vector_declare  →（初學課程看不到）→ 顯示成 cpp:var_declare
   * 使用者拖一下任何一顆積木 → 抽回來的樹是 cpp:var_declare → 它成為真實
   * ```
   *
   * > **降級的視圖被使用者動一下，就變成了真實。**
   *
   * 使用者不必做任何特別的事——載入一份降級過的程式、碰任何一顆積木，
   * 原始語義就沒了，而且**存檔之後救不回來**。
   *
   * 這張表讓那一步可逆：`_blockIdToNodeId` 已經在來回轉換保住原 nodeId
   * （`blockly-panel.ts` 的「Restore original nodeId」），所以抽回來的節點
   * 認得出自己是誰。
   */
  private identityBeforeDowngrade = new Map<string, string>()
  private lifter: Lifter | null = null
  private parser: CodeParser | null = null
  private syncing = false
  private codeMappings: CodeMapping[] = []
  private blockMappings: BlockMapping[] = []
  private onErrorCallback: ((errors: SyncError[]) => void) | null = null
  private onStyleExceptionsCallback: ((exceptions: StyleException[], apply: () => void) => void) | null = null
  private onIoConformanceCallback: ((result: IoConformanceResult) => void) | null = null
  private codingStyle: CodingStyle | null = null
  private programScaffold: ProgramScaffold | null = null
  private currentTopic: Topic | null = null
  private enabledBranches: Set<string> = new Set()
  private codePatcherFn: ((code: string, tree: SemanticNode) => string | null) | null = null
  private scaffoldNodeFilter: ScaffoldNodeFilter = identityFilter
  private displayTreeEnhancer: ((tree: SemanticNode, visible: Set<string>, scaffoldVisible: boolean) => SemanticNode) | null = null

  constructor(
    bus: SemanticBus,
    language: string,
    style: StylePreset,
  ) {
    this.bus = bus
    this.language = language
    this.style = style

    // Subscribe to view requests
    bus.on('edit:blocks', (data) => this.handleEditBlocks(data))
    bus.on('edit:code', (data) => this.handleEditCode(data))
  }

  /** Set lifter and parser for code→blocks direction (US2) */
  setCodeToBlocksPipeline(lifter: Lifter, parser: CodeParser): void {
    this.lifter = lifter
    this.parser = parser
  }

  onError(callback: (errors: SyncError[]) => void): void {
    this.onErrorCallback = callback
  }

  onStyleExceptions(callback: (exceptions: StyleException[], apply: () => void) => void): void {
    this.onStyleExceptionsCallback = callback
  }

  /** Called when code→blocks detects I/O style non-conformance (借音 or 轉調) */
  onIoConformance(callback: (result: IoConformanceResult) => void): void {
    this.onIoConformanceCallback = callback
  }

  setCodingStyle(preset: StylePreset): void {
    this.codingStyle = toCodingStyle(preset)
  }

  setProgramScaffold(scaffold: ProgramScaffold): void {
    this.programScaffold = scaffold
  }

  setTopic(topic: Topic, enabledBranches: Set<string>): void {
    this.currentTopic = topic
    this.enabledBranches = enabledBranches
  }

  setBranches(enabledBranches: Set<string>): void {
    this.enabledBranches = enabledBranches
  }

  /** Get the max enabled tree depth (for scaffold visibility). */
  private getScaffoldDepth(): number {
    if (!this.currentTopic) return 2
    const allNodes = flattenLevelTree(this.currentTopic.levelTree)
    let maxLevel = 0
    for (const node of allNodes) {
      if (this.enabledBranches.has(node.id)) {
        maxLevel = Math.max(maxLevel, node.level)
      }
    }
    return maxLevel
  }

  /** Whether scaffold nodes should be stripped for display (depth 0 = only root enabled). */
  private shouldStripScaffold(): boolean {
    return this.getScaffoldDepth() === 0
  }

  /** Set the scaffold node filter for L0 display (strip scaffold from blocks) */
  setScaffoldNodeFilter(fn: ScaffoldNodeFilter): void {
    this.scaffoldNodeFilter = fn
  }

  /**
   * Set a display tree enhancer — called just before renderToBlocklyState() to inject
   * virtual nodes (e.g., auto-include cpp_include nodes) into the display tree.
   * The enhancer receives the tree, the current visible concept set, and a
   * `scaffoldVisible` flag (true when depth > 0, i.e., scaffold nodes are shown).
   * It must NOT mutate the original tree.
   */
  setDisplayTreeEnhancer(fn: (tree: SemanticNode, visible: Set<string>, scaffoldVisible: boolean) => SemanticNode): void {
    this.displayTreeEnhancer = fn
  }

  /** Apply the display tree enhancer (if set) and return the enhanced tree. */
  private enhanceDisplayTree(tree: SemanticNode): SemanticNode {
    if (!this.displayTreeEnhancer || !this.currentTopic) return tree
    const visible = getVisibleConcepts(this.currentTopic, this.enabledBranches)
    const scaffoldVisible = !this.shouldStripScaffold()
    return this.displayTreeEnhancer(tree, visible, scaffoldVisible)
  }

  /** Set a language-specific code patcher for auto-fixing missing dependencies after code→blocks */
  setCodePatcher(fn: (code: string, tree: SemanticNode) => string | null): void {
    this.codePatcherFn = fn
  }

  /** Patch code with missing dependencies (e.g. #include). Returns patched code or null if unchanged. */
  patchMissingDependencies(code: string): string | null {
    if (!this.codePatcherFn || !this.currentTree) return null
    return this.codePatcherFn(code, this.currentTree)
  }

  /** Set block mappings from external source (e.g., blockly-panel extraction) */
  setBlockMappings(mappings: BlockMapping[]): void {
    this.blockMappings = mappings
  }


  /** Handle edit:blocks event — sync blocks → semantic tree → code */
  private handleEditBlocks(data: { blocklyState: unknown }): void {
    if (this.syncing) return
    this.syncing = true
    try {
      const blocklyState = data.blocklyState as { tree: SemanticNode; blockMappings?: BlockMapping[] }
      const tree = blocklyState.tree
      // ⚠️ **還原被降級的身分**——否則使用者拖一下積木，真實就變成降級後的樣子。
      // 見 `降級前的身分` 的檔頭：閉環的系統裡，輸出端的損失會從輸入端回來。
      this.restoreDowngrade(tree)
      this.currentTree = tree
      const { code, mappings } = generateCodeWithMapping(tree, this.language, this.style)
      this.codeMappings = mappings

      // Use blockMappings from extraction if provided
      if (blocklyState.blockMappings) {
        this.blockMappings = blocklyState.blockMappings
      }


      // Compute scaffold result for ghost line decorations
      let scaffoldResult: ScaffoldResult | undefined
      if (this.programScaffold) {
        scaffoldResult = this.programScaffold.resolve(tree, {
          scaffoldDepth: this.getScaffoldDepth(),
        })
      }

      // Inject auto-include blocks and re-render so blocks panel reflects new includes.
      // Uses busUpdateInProgress flag (in blockly-panel) to prevent onChange feedback loop.
      // Note: keep blockMappings from blocklyState (set above) — don't overwrite with re-render IDs.
      const displayTree = this.shouldStripScaffold() ? this.scaffoldNodeFilter(tree) : tree
      const renderResult = renderToBlocklyState(this.enhanceDisplayTree(displayTree))

      this.bus.emit('semantic:update', { tree, code, blockState: renderResult, source: 'blocks', mappings, scaffoldResult })
    } finally {
      this.syncing = false
    }
  }

  /** Handle edit:code event — sync code → semantic tree → blocks */
  private handleEditCode(data: { code: string }): void {
    if (this.syncing || !this.lifter || !this.parser) return
    this.syncing = true
    try {
      const code = data.code
      const parseResult = this.parser.parse(code)
      const rootNode = parseResult.rootNode as import('../core/lift/types').AstNode

      // Report parse errors but continue sync — lifter degrades ERROR nodes to raw_code.
      // Previously this aborted sync entirely, but that caused blocks to disappear on
      // mobile where intermediate typing states produce transient ERROR nodes.
      const errors = this.findErrors(rootNode)
      if (errors.length > 0) {
        this.onErrorCallback?.(errors)
      }

      // Code-level I/O conformance check (before lift — 借音/轉調 detection)
      let ioResult: IoConformanceResult | null = null
      if (this.codingStyle) {
        const result = analyzeIoConformance(code, this.codingStyle.ioPreference)
        if (result.verdict !== 'conforming') {
          ioResult = result
        }
      }

      let tree = this.lifter.lift(rootNode)
      if (!tree) return

      // Semantic-level style exception check (after lift — toolbox block mismatches)
      let semanticExceptions: StyleException[] = []
      let applySemanticConversions: (() => void) | null = null
      if (this.codingStyle) {
        const exceptions = detectStyleExceptions(tree, this.codingStyle)
        if (exceptions.length > 0) {
          semanticExceptions = exceptions
          const currentTree = tree
          applySemanticConversions = () => {
            const converted = applyStyleConversions(currentTree, exceptions)
            this.currentTree = converted
            const { mappings: convMappings } = generateCodeWithMapping(converted, this.language, this.style)
            this.codeMappings = convMappings
            const convDisplay = this.shouldStripScaffold() ? this.scaffoldNodeFilter(converted) : converted
            const convRender = renderToBlocklyState(this.enhanceDisplayTree(convDisplay))
            this.blockMappings = convRender.blockMappings
      
            this.bus.emit('semantic:update', { tree: converted, blockState: convRender, source: 'code', mappings: this.codeMappings })
          }
        }
      }

      // Fire callbacks — prioritize bulk deviation (轉調) over semantic exceptions over minor exception (借音)
      if (ioResult?.verdict === 'bulk_deviation' && this.onIoConformanceCallback) {
        this.onIoConformanceCallback(ioResult)
      } else if (semanticExceptions.length > 0 && this.onStyleExceptionsCallback && applySemanticConversions) {
        this.onStyleExceptionsCallback(semanticExceptions, applySemanticConversions)
      } else if (ioResult?.verdict === 'minor_exception' && this.onIoConformanceCallback) {
        this.onIoConformanceCallback(ioResult)
      }

      this.currentTree = tree

      // In code→blocks direction, Monaco keeps the original code.
      // Use sourceRange from lifted nodes for accurate line mapping to the original code,
      // supplemented by generateCodeWithMapping for nodes without sourceRange.
      const { mappings: genMappings } = generateCodeWithMapping(tree, this.language, this.style)
      this.codeMappings = this.buildCodeMappingsFromSourceRange(tree, genMappings)

      // 降級只作用在**顯示用的拷貝**上——`tree` 是真實，執行要拿到它。
      // （`downgradeConceptsForLevel` 是就地改寫，見 `cloneTree` 的說明）
      // ⚠️ 這個變數原本叫「顯示樹」，而下面還有一個英文的 `displayTree`
      // ——改名時**兩個撞在一起**。它是**降級後**的樹，`displayTree` 是
      // 再濾掉鷹架之後的；名字要分得出這一層差別。
      let downgradedTree = tree
      this.identityBeforeDowngrade.clear()
      if (this.currentTopic) {
        const visible = getVisibleConcepts(this.currentTopic, this.enabledBranches)
        downgradedTree = this.cloneTree(tree)
        this.downgradeConceptsForLevel(downgradedTree, visible)
      }

      // For L0: strip scaffold nodes so blocks only show user's logic
      const displayTree = this.shouldStripScaffold() ? this.scaffoldNodeFilter(downgradedTree) : downgradedTree
      const renderResult = renderToBlocklyState(this.enhanceDisplayTree(displayTree))
      this.blockMappings = renderResult.blockMappings

      // ⚠️ `mappings` 不可漏。`code` 方向的兩處 emit 原本沒帶它，
      // 因為在此之前**沒有人接**——`codeMappings` 只有這個檔自己在用。
      // 而視圖自己接手「執行到哪一行」之後，漏掉它的症狀是
      // **打程式碼之後執行，程式碼那邊不會高亮，而積木那邊會**
      // ——一個只在單一方向出現的不對稱。
      this.bus.emit('semantic:update', { tree, blockState: renderResult, source: 'code', mappings: this.codeMappings })
    } finally {
      this.syncing = false
    }
  }

  /**
   * 深拷貝一棵語義樹——**給降級用的**。
   *
   * ⚠️ `downgradeConceptsForLevel` 是**就地改寫**，而 `this.currentTree` 指向
   * 同一個物件。少了這個拷貝，降級的結果會**直接覆寫真實**：
   *
   * ```
   * vector<int> v;  →  cpp:vector_declare  →（初學課程看不到它）→ lang:var_declare
   *                                            ↑ currentTree 也變成這個
   * 然後按「執行」→ int v; → v[0] → RUNTIME_ERR_TYPE_MISMATCH
   * ```
   *
   * **降級是投影層的事，不該寫回真實**（根公理：唯一真實，各式投影）。
   * 顯示可以退到父概念，執行必須拿到原本的那棵。
   *
   * 實測發現於 2026-08-08 的瀏覽器驗證，而全套 3682 支測試是綠的——
   * 因為降級只在「課程可見集合」這條路上發生，而測試幾乎都用全部可見的設定跑。
   */
  private cloneTree(node: SemanticNode): SemanticNode {
    const children: Record<string, SemanticNode[]> = {}
    for (const [k, arr] of Object.entries(node.children ?? {})) children[k] = arr.map((c) => this.cloneTree(c))
    return { ...node, properties: { ...node.properties }, children }
  }

  /**
   * Downgrade concepts not visible in current level to universal equivalents.
   * If no universal equivalent exists, keep the original concept (never degrade to raw_code).
   * Mutates the tree in place.
   */
  private downgradeConceptsForLevel(node: SemanticNode, visible: Set<string>): void {
    // 降級目標由**概念自己宣告的父概念**決定，不再寫死在這裡。
    //
    // 這份清單原本有 16 行，全部在講同一件事：「這些概念是變數宣告的一種」。
    // 而概念定義裡本來就有 `abstractConcept` 這個欄位在表達它——只是那時
    // 98 個父概念指向的東西**根本不存在**，所以介面層只好自己寫一份。
    // 見 specs/056-abstract-concept-integrity
    // 來源是概念自己的宣告，由語言套件在載入時推進核心

    if (!visible.has(node.conceptId)) {
      const parent = abstractConceptOf(node.conceptId)
      // 型別前綴由概念自己宣告——介面層不該認得哪個概念宣告的是字串
      const downgrade = parent ? { conceptId: parent, typePrefix: variableTypeOf(node.conceptId) } : undefined
      if (downgrade && visible.has(downgrade.conceptId)) {
        // Preserve type info in properties
        if (downgrade.typePrefix && !node.properties.type) {
          node.properties.type = downgrade.typePrefix
        }
        // ⚠️ 記下來，讓 blocks→code 那個方向還原得回去（見 `降級前的身分`）。
        this.identityBeforeDowngrade.set(node.id, node.conceptId)
        node.conceptId = downgrade.conceptId
      }
      // If no downgrade mapping or target also not visible → keep original (never raw_code)
    }

    // Recurse into children
    for (const children of Object.values(node.children)) {
      if (Array.isArray(children)) {
        for (const child of children) {
          this.downgradeConceptsForLevel(child, visible)
        }
      }
    }
  }

  /** Convenience: trigger blocks→code sync from external code (e.g., app.ts) */
  syncBlocksToCode(tree?: SemanticNode, blockMappings?: BlockMapping[]): void {
    const t = tree ?? this.currentTree
    if (!t) return
    this.handleEditBlocks({ blocklyState: { tree: t, blockMappings } })
  }

  /**
   * Resync both panels after a topic/branch change.
   * - depth 0: blocks show body-only (scaffold stripped), code shows full (scaffold-wrapped)
   * - depth 1+: blocks show full tree, code shows full
   * When switching FROM depth 0 TO deeper, re-lifts from code to recover full tree.
   */
  resyncForTopic(extractedTree: SemanticNode, currentCode: string): void {
    if (this.syncing) return
    this.syncing = true
    try {
      let fullTree = extractedTree

      // If switching TO L1/L2 and tree has no main func (body-only from L0),
      // re-lift from the current code to get the full tree
      const hasMainFunc = (extractedTree.children.body ?? []).some(
        n => isFunctionDefinition(n.conceptId) && n.properties.name === 'main'
      )
      if (this.getScaffoldDepth() > 0 && !hasMainFunc && this.lifter && this.parser) {
        const parseResult = this.parser.parse(currentCode)
        const rootNode = parseResult.rootNode as import('../core/lift/types').AstNode
        if (rootNode) {
          const lifted = this.lifter.lift(rootNode)
          if (lifted) fullTree = lifted
        }
      }

      this.currentTree = fullTree

      // Generate code (scaffold wraps body-only trees; full trees use legacy path)
      const { code, mappings } = generateCodeWithMapping(fullTree, this.language, this.style)
      this.codeMappings = mappings

      // Compute scaffold result for Monaco ghost decorations
      let scaffoldResult: ScaffoldResult | undefined
      if (this.programScaffold) {
        scaffoldResult = this.programScaffold.resolve(fullTree, {
          scaffoldDepth: this.getScaffoldDepth(),
        })
      }

      // 同上：降級只作用在顯示用的拷貝上，`fullTree` 保持真實
      let downgradedTree = fullTree
      if (this.currentTopic) {
        const visible = getVisibleConcepts(this.currentTopic, this.enabledBranches)
        downgradedTree = this.cloneTree(fullTree)
        this.downgradeConceptsForLevel(downgradedTree, visible)
      }

      // For blocks: strip scaffold if L0
      const displayTree = this.shouldStripScaffold() ? this.scaffoldNodeFilter(downgradedTree) : downgradedTree
      const renderResult = renderToBlocklyState(this.enhanceDisplayTree(displayTree))
      this.blockMappings = renderResult.blockMappings

      // Emit resync event — updates both code and block panels
      this.bus.emit('semantic:update', {
        tree: fullTree, code, blockState: renderResult, source: 'resync', mappings, scaffoldResult,
      })
    } finally {
      this.syncing = false
    }
  }

  /** Convenience: trigger code→blocks sync from external code (e.g., app.ts) */
  syncCodeToBlocks(code?: string): boolean {
    if (!this.lifter || !this.parser) return false
    if (code !== undefined) {
      this.handleEditCode({ code })
      return true
    }
    return false
  }

  /**
   * 把 blocks→code 抽回來的樹裡、**被降級過的節點**還原成原本的身分。
   *
   * 只還原「這個節點當初真的被降級過，而且它現在仍然是那個降級目標」的情況
   * ——**使用者真的把它換成別的概念時不得還原**（那是使用者的編輯，不是投影損失）。
   */
  private restoreDowngrade(node: SemanticNode): void {
    const original = this.identityBeforeDowngrade.get(node.id)
    if (original !== undefined && node.conceptId === abstractConceptOf(original)) {
      node.conceptId = original
    }
    for (const children of Object.values(node.children ?? {})) {
      if (Array.isArray(children)) for (const c of children) this.restoreDowngrade(c)
    }
  }

  getCurrentTree(): SemanticNode | null {
    return this.currentTree
  }

  getBus(): SemanticBus {
    return this.bus
  }

  setStyle(style: StylePreset): void {
    this.style = style
  }

  setLanguage(language: string): void {
    this.language = language
  }

  isSyncing(): boolean {
    return this.syncing
  }

  getCodeMappings(): CodeMapping[] {
    return [...this.codeMappings]
  }

  getBlockMappings(): BlockMapping[] {
    return [...this.blockMappings]
  }

  /** Build blockId→nodeId reverse map for extraction to reuse original nodeIds */
  getBlockIdToNodeIdMap(): Map<string, string> {
    const map = new Map<string, string>()
    for (const bm of this.blockMappings) {
      map.set(bm.blockId, bm.nodeId)
    }
    return map
  }

  /** Block→Code: blockId → BlockMapping → nodeId → CodeMapping → {startLine, endLine} */
  getMappingForBlock(blockId: string): { blockId: string; startLine: number; endLine: number } | null {
    const bm = this.blockMappings.find(m => m.blockId === blockId)
    if (!bm) return null
    const cm = this.codeMappings.find(m => m.nodeId === bm.nodeId)
    if (!cm) return null
    return { blockId, startLine: cm.startLine, endLine: cm.endLine }
  }

  /** Node→Block+Code: nodeId → blockId (if block exists) + startLine/endLine (if code exists) */
  getMappingForNode(nodeId: string): { blockId: string | null; startLine: number | null; endLine: number | null } | null {
    const bm = this.blockMappings.find(m => m.nodeId === nodeId)
    let cm = this.codeMappings.find(m => m.nodeId === nodeId)

    // Fallback: expression nodes don't have codeMappings — walk up the tree to find
    // the nearest ancestor that does (e.g., while_loop containing a scanf expression)
    if (!cm && this.currentTree) {
      const ancestorId = this.findAncestorWithCodeMapping(this.currentTree, nodeId)
      if (ancestorId) cm = this.codeMappings.find(m => m.nodeId === ancestorId)
    }

    if (!bm && !cm) return null
    return {
      blockId: bm?.blockId ?? null,
      startLine: cm?.startLine ?? null,
      endLine: cm?.endLine ?? null,
    }
  }

  /** Walk tree to find the nearest ancestor of targetId that has a codeMapping */
  private findAncestorWithCodeMapping(node: SemanticNode, targetId: string): string | null {
    // Check if targetId is a descendant of this node
    if (!this.containsNodeId(node, targetId)) return null
    // This node contains the target — check children for a tighter match
    for (const children of Object.values(node.children)) {
      for (const child of children) {
        const found = this.findAncestorWithCodeMapping(child, targetId)
        if (found) return found
      }
    }
    // No child ancestor found — this node is the nearest ancestor with a codeMapping (if it has one)
    if (this.codeMappings.some(m => m.nodeId === node.id)) return node.id
    return null
  }

  /** Check if a node or any descendant has the given id */
  private containsNodeId(node: SemanticNode, targetId: string): boolean {
    if (node.id === targetId) return true
    for (const children of Object.values(node.children)) {
      for (const child of children) {
        if (this.containsNodeId(child, targetId)) return true
      }
    }
    return false
  }

  /** Code→Block: line → CodeMapping → nodeId → BlockMapping → {blockId} */
  getMappingForLine(line: number): { blockId: string | null; startLine: number; endLine: number } | null {
    const best = this.bestCodeMappingForLine(line)
    if (!best) return null
    const bm = this.blockMappings.find(m => m.nodeId === best.nodeId)
    return { blockId: bm?.blockId ?? null, startLine: best.startLine, endLine: best.endLine }
  }

  /** Decoupled query: line → nodeId (smallest enclosing code mapping) */
  nodeIdForLine(line: number): string | null {
    return this.bestCodeMappingForLine(line)?.nodeId ?? null
  }

  /** Decoupled query: nodeId → code range */
  codeRangeForNode(nodeId: string): { startLine: number; endLine: number } | null {
    let cm = this.codeMappings.find(m => m.nodeId === nodeId)
    // Fallback for expression nodes: walk up to nearest ancestor with codeMapping
    if (!cm && this.currentTree) {
      const ancestorId = this.findAncestorWithCodeMapping(this.currentTree, nodeId)
      if (ancestorId) cm = this.codeMappings.find(m => m.nodeId === ancestorId)
    }
    return cm ? { startLine: cm.startLine, endLine: cm.endLine } : null
  }

  /** Find the smallest code mapping containing the given line */
  private bestCodeMappingForLine(line: number): CodeMapping | null {
    let best: CodeMapping | null = null
    for (const cm of this.codeMappings) {
      if (line >= cm.startLine && line <= cm.endLine) {
        if (!best || (cm.endLine - cm.startLine) < (best.endLine - best.startLine)) {
          best = cm
        }
      }
    }
    return best
  }

  /**
   * Build code mappings using sourceRange from lifted nodes (accurate to original code),
   * falling back to generateCodeWithMapping entries for nodes without sourceRange.
   * Only includes statement-level nodes (those tracked by generateNode), not expressions.
   */
  private buildCodeMappingsFromSourceRange(tree: SemanticNode, genMappings: CodeMapping[]): CodeMapping[] {
    // Collect sourceRange for all nodes by nodeId
    const srMap = new Map<string, { startLine: number; endLine: number }>()
    this.collectSourceRanges(tree, srMap)

    // For each genMapping entry, prefer sourceRange if available
    return genMappings.map(m => {
      const sr = srMap.get(m.nodeId)
      if (sr) {
        return { nodeId: m.nodeId, startLine: sr.startLine, endLine: sr.endLine }
      }
      return m
    })
  }

  private collectSourceRanges(node: SemanticNode, map: Map<string, { startLine: number; endLine: number }>): void {
    const sr = node.metadata?.sourceRange as { startLine: number; endLine: number } | undefined
    if (sr && node.id) {
      map.set(node.id, sr)
    }
    for (const children of Object.values(node.children)) {
      for (const child of children) {
        this.collectSourceRanges(child, map)
      }
    }
  }

  private findErrors(node: import('../core/lift/types').AstNode): SyncError[] {
    const errors: SyncError[] = []
    this.walkForErrors(node, errors)
    return errors
  }

  private walkForErrors(node: import('../core/lift/types').AstNode, errors: SyncError[]): void {
    if (node.type === 'ERROR') {
      errors.push({
        message: `Syntax error at line ${node.startPosition.row + 1}`,
        line: node.startPosition.row,
        column: node.startPosition.column,
        text: node.text,
      })
    }
    for (const child of node.children) {
      this.walkForErrors(child, errors)
    }
  }
}

export interface SyncError {
  message: string
  line: number
  column: number
  text: string
}
