import type { SemanticNode, StylePreset, Topic } from './types'
import { flattenLevelTree, getVisibleComponents } from './level-tree'
import type { ProgramScaffold, ScaffoldResult } from './program-scaffold'
// 🔴 **不再 import 語言套件**（spec 153）——風格分析由組裝點推進來。
//
// ⚠️ 兩種做法都論證過：
//   ① 抽成核心的通用機制 → 🔴 否決：「這段程式碼的風格例外是什麼」
//      是**語言的知識**（`cout` vs `printf`），核心抽象不出來
//   ② 讓語言套件推一組函式進來 → 🟢 選這個，與
//      `skip-declarations`／`comment-syntax`／`language-executors` 同一個形狀
//
// > **機制跨不過分層時，讓特例自己帶著宣告來**（`experience`）。
import type { StyleException, StyleConformance } from './types'
// 🔴 **一個語言套件的匯入都不剩**（spec 153）。
//    原本連 `StyleConformance` 的型別都從語言套件來——而這一層
//    **只讀 `verdict`**，其餘欄位只是轉交。
//
//    > **視圖需要的是【判決】，不是【證據】。**
//
//    ⚠️ 而語言專屬的細節（`iostreamCount`／`cstdioCount`）留在語言套件，
//    由組裝點與消費端自己收窄——**不要為了拿掉一個 import 就把欄位搬進核心**。

/** 風格分析——由組裝點推進來（spec 153）。 */
export interface StyleAnalyzer {
  // 🔴 收的是**核心的** `StylePreset`，不是語言的 `CodingStyle`（2026-08-24）。
  // 在此之前這個檔 import 了 `languages/style` 並自己做轉換，於是
  // **即時互轉的引擎認識 C++ 的詞彙**（`'iostream'`／`'cstdio'`／`'bits'`）。
  // 收窄留在語言那側——組裝點那句註解本來就寫著「**收窄發生在組裝點**」。
  //
  // 🔴 **三支都可能回傳 `undefined`——因為不是每個語言都有風格例外這回事。**
  //
  // ⚠️ 在此之前它們宣告成「一定回傳」，而組裝點（`app.ts`）串的是
  // `languagePack(lang)?.styleExceptions?.analyzeIo(...)`——**Python 套件
  // 根本沒有 `styleExceptions`**，於是那條 `?.` 鏈交出 `undefined`，
  // 而消費端直接 `result.verdict`。
  //
  // 症狀是 **Python 的程式碼→積木整條不通**：`print(1)` 產出一棵空的
  // `python:program`，主控台一行 `Parse error: TypeError`，而畫面上
  // **看起來只是「這段程式沒有積木」**。
  //
  // > **一個用 `as never` 蓋過去的樂觀簽章，會把「這個語言沒有這件事」
  // > 變成一次執行期崩潰——而崩潰的地方離原因很遠。**
  //
  // 🔴 **修法不是在消費端補 `?.`**（那是第七十五條護欄禁的「沒看過的東西
  // 給一個『繼續』」）——**是讓宣告說實話**，讓型別檢查逼消費端處理它。
  detectStyleExceptions: (tree: SemanticNode, style: StylePreset) => StyleException[] | undefined
  applyStyleConversions: (tree: SemanticNode, exceptions: StyleException[]) => SemanticNode | undefined
  analyzeIoConformance: (code: string, pref: string) => StyleConformance | undefined
}
import { generateCodeWithMapping } from './projection/code-generator'

import type { CodeMapping, BlockMapping } from './projection/code-generator'
import { renderToBlocklyState } from './projection/block-renderer'
import { Lifter } from './lift/lifter'
import { SemanticBus } from './semantic-bus'
import { abstractComponentOf, variableTypeOf } from './language-executors'
import { isFunctionDefinition } from './component/traits'

/** Scaffold node filter type — strips scaffold nodes for L0 display */
export type ScaffoldNodeFilter = (tree: SemanticNode) => SemanticNode

/** Default no-op filter (returns tree as-is) */
function identityFilter(tree: SemanticNode): SemanticNode {
  return tree
}

export interface CodeParser {
  /**
   * 🔴 **非同步**（2026-08-26）。
   *
   * 它本來宣告成同步的，而**每一個真的 parser 都是非同步的**（要抓 wasm）。
   * 於是**兩個消費者各做了一份一模一樣的轉接**：先在外面 `await` 解析，
   * 把結果塞進一個假的 parser（`{ _lastTree, parse() { return { rootNode: this._lastTree } } }`），
   * 再呼叫這裡。
   *
   * > **一個介面如果每個實作者都要在它前面加同一層轉接，
   * > 那層轉接就是介面的一部分。**
   *
   * ⚠️ 那個非同步**本來就在跑**（`app.ts` 的 wrapper 幾週前就這樣做）——
   * 這一刀不是把同步改成非同步，是**把一段已經在跑的非同步搬進介面裡**。
   */
  parse(code: string): Promise<{ rootNode: unknown }>
}

export class SyncController {
  /**
   * 風格分析——⚠️ **省略時整段跳過**（不是猜一個結果）。
   * 🟢 組裝點一定會裝（`app.ts`）；沒裝時的行為是「不做風格轉換」，
   *    而那是**誠實的降級**：沒有規則就說不出例外。
   */
  private styleAnalyzer: StyleAnalyzer | null = null

  /** 組裝點推進來。⚠️ 必須在第一次同步之前。 */
  setStyleAnalyzer(analyzer: StyleAnalyzer): void {
    this.styleAnalyzer = analyzer
  }

  private bus: SemanticBus
  private language: string
  private style: StylePreset
  private currentTree: SemanticNode | null = null

  /**
   * 被降級的節點：`nodeId → 原本的 componentId`。
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
  private onIoConformanceCallback: ((result: StyleConformance) => void) | null = null
  private codingStyle: StylePreset | null = null
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
    bus.on('edit:tree', (data) => this.handleEditTree(data))
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
  onIoConformance(callback: (result: StyleConformance) => void): void {
    this.onIoConformanceCallback = callback
  }

  setCodingStyle(preset: StylePreset): void {
    this.codingStyle = preset
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
   * The enhancer receives the tree, the current visible component set, and a
   * `scaffoldVisible` flag (true when depth > 0, i.e., scaffold nodes are shown).
   * It must NOT mutate the original tree.
   */
  setDisplayTreeEnhancer(fn: (tree: SemanticNode, visible: Set<string>, scaffoldVisible: boolean) => SemanticNode): void {
    this.displayTreeEnhancer = fn
  }

  /** Apply the display tree enhancer (if set) and return the enhanced tree. */
  private enhanceDisplayTree(tree: SemanticNode): SemanticNode {
    if (!this.displayTreeEnhancer || !this.currentTopic) return tree
    const visible = getVisibleComponents(this.currentTopic, this.enabledBranches)
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


  /**
   * **某個視圖把樹改了 → 產生程式碼**（2026-08-26 由 `handleEditBlocks` 改名）。
   *
   * 🔴 它收的**一直都是一棵樹**——只有名字是視圖專屬的。
   * 流程面板成為第二個樹形來源時，照舊命名就會長出第二個處理函式。
   */
  private handleEditTree(data: { viewId?: string; tree: SemanticNode; blockMappings?: BlockMapping[] }): void {
    if (this.syncing) return
    this.syncing = true
    try {
      const tree = data.tree
      // ⚠️ **還原被降級的身分**——否則使用者拖一下積木，真實就變成降級後的樣子。
      //
      // > **閉環的系統裡，輸出端的損失會從輸入端回來。**
      //
      // 判準與它跟「單調遞減」的分工，見
      // `knowledge/concepts/降級與認知邊界.md`「降級前的身分——閉環系統的回流」。
      // ⚠️ 這裡原本寫「見 `降級前的身分` 的檔頭」，**而那個檔從來不存在**
      // （2026-08-18 補上；機制早就在跑，缺的是那份被指名的文件）。
      this.restoreDowngrade(tree)
      this.currentTree = tree
      const { code, mappings } = generateCodeWithMapping(tree, this.language, this.style)
      this.codeMappings = mappings

      // Use blockMappings from extraction if provided
      if (data.blockMappings) {
        this.blockMappings = data.blockMappings
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

      // ⚠️ `source: 'blocks'` 保留原義（「樹被某個視圖改了」），而**誰改的**
      //    由 `originViewId` 如實帶下去——見它的說明。
      this.bus.emit('semantic:update', {
        tree, code, blockState: renderResult, source: 'blocks',
        originViewId: data.viewId, mappings, scaffoldResult,
      })
    } finally {
      this.syncing = false
    }
  }

  /** Handle edit:code event — sync code → semantic tree → blocks */
  private async handleEditCode(data: { code: string }): Promise<void> {
    if (this.syncing || !this.lifter || !this.parser) return
    // ⚠️ **`syncing` 的設定與清除要包住整段 `await`**——重入守衛的窗口
    //    因為非同步而變長了，而 `try/finally` 已經在外面（見函式尾）。
    this.syncing = true
    try {
      const code = data.code
      const parseResult = await this.parser.parse(code)
      const rootNode = parseResult.rootNode as import('../core/lift/types').AstNode

      // Report parse errors but continue sync — lifter degrades ERROR nodes to raw_code.
      // Previously this aborted sync entirely, but that caused blocks to disappear on
      // mobile where intermediate typing states produce transient ERROR nodes.
      const errors = this.findErrors(rootNode)
      if (errors.length > 0) {
        this.onErrorCallback?.(errors)
      }

      // Code-level I/O conformance check (before lift — 借音/轉調 detection)
      let ioResult: StyleConformance | null = null
      if (this.codingStyle) {
        // ⚠️ `undefined` ＝ **這個語言沒有 I/O 風格這回事**（Python），
        //    不是「檢查失敗」。兩者處置相同（不提示），而意思不同。
        const result = this.styleAnalyzer!.analyzeIoConformance(code, this.codingStyle.io_style)
        if (result !== undefined && result.verdict !== 'conforming') {
          ioResult = result
        }
      }

      let tree = this.lifter.lift(rootNode)
      if (!tree) return

      // Semantic-level style exception check (after lift — toolbox block mismatches)
      let semanticExceptions: StyleException[] = []
      let applySemanticConversions: (() => void) | null = null
      if (this.codingStyle) {
        // ⚠️ 同上——沒有這回事的語言拿到 `undefined`，不是空陣列。
        const exceptions = this.styleAnalyzer!.detectStyleExceptions(tree, this.codingStyle)
        if (exceptions !== undefined && exceptions.length > 0) {
          semanticExceptions = exceptions
          const currentTree = tree
          applySemanticConversions = () => {
            const converted = this.styleAnalyzer!.applyStyleConversions(currentTree, exceptions)
            // 🔴 走到這裡代表 `detectStyleExceptions` 交出過東西，
            //    所以同一個套件的 `convert` 不該是 undefined——真的是的話
            //    **那是套件宣告不一致，要出聲，不要靜靜用原樹繼續**。
            if (converted === undefined) {
              console.error('風格轉換：套件宣告了 detect 卻沒有 convert')
              return
            }
            this.currentTree = converted
            const { mappings: convMappings } = generateCodeWithMapping(converted, this.language, this.style)
            this.codeMappings = convMappings
            const convDisplay = this.shouldStripScaffold() ? this.scaffoldNodeFilter(converted) : converted
            const convRender = renderToBlocklyState(this.enhanceDisplayTree(convDisplay))
            this.blockMappings = convRender.blockMappings
      
            this.bus.emit('semantic:update', { tree: converted, code, blockState: convRender, source: 'code', mappings: this.codeMappings })
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
      // （`downgradeComponentsForLevel` 是就地改寫，見 `cloneTree` 的說明）
      // ⚠️ 這個變數原本叫「顯示樹」，而下面還有一個英文的 `displayTree`
      // ——改名時**兩個撞在一起**。它是**降級後**的樹，`displayTree` 是
      // 再濾掉鷹架之後的；名字要分得出這一層差別。
      let downgradedTree = tree
      this.identityBeforeDowngrade.clear()
      if (this.currentTopic) {
        const visible = getVisibleComponents(this.currentTopic, this.enabledBranches)
        downgradedTree = this.cloneTree(tree)
        this.downgradeComponentsForLevel(downgradedTree, visible)
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
      // ⚠️ `code` 也不可漏，而它漏掉的方式與 `mappings` 一模一樣：
      // **對映是行號，而行號要有那份文字才有意義。** 少了它，一個
      // 「拿對映去查那一行寫什麼」的視圖（流程圖）在 code 方向會全部退回
      // 內部名字（`var_assign`），**而在 blocks 方向是好的**——又是一個
      // 只在單一方向出現的不對稱。
      //
      // 🟢 程式碼面板不受影響：它只在 `blocks`／`resync` 才回寫（見 monaco-panel）。
      this.bus.emit('semantic:update', { tree, code, blockState: renderResult, source: 'code', mappings: this.codeMappings })
    } finally {
      this.syncing = false
    }
  }

  /**
   * 深拷貝一棵語義樹——**給降級用的**。
   *
   * ⚠️ `downgradeComponentsForLevel` 是**就地改寫**，而 `this.currentTree` 指向
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
   * Downgrade components not visible in current level to universal equivalents.
   * If no universal equivalent exists, keep the original component (never degrade to raw_code).
   * Mutates the tree in place.
   */
  private downgradeComponentsForLevel(node: SemanticNode, visible: Set<string>): void {
    // 降級目標由**概念自己宣告的父概念**決定，不再寫死在這裡。
    //
    // 這份清單原本有 16 行，全部在講同一件事：「這些概念是變數宣告的一種」。
    // 而概念定義裡本來就有 `abstractComponent` 這個欄位在表達它——只是那時
    // 98 個父概念指向的東西**根本不存在**，所以介面層只好自己寫一份。
    // 見 specs/056-abstract-concept-integrity
    // 來源是概念自己的宣告，由語言套件在載入時推進核心

    if (!visible.has(node.componentId)) {
      const parent = abstractComponentOf(node.componentId)
      // 型別前綴由概念自己宣告——介面層不該認得哪個概念宣告的是字串
      const downgrade = parent ? { componentId: parent, typePrefix: variableTypeOf(node.componentId) } : undefined
      if (downgrade && visible.has(downgrade.componentId)) {
        // Preserve type info in properties
        if (downgrade.typePrefix && !node.properties.type) {
          node.properties.type = downgrade.typePrefix
        }
        // ⚠️ 記下來，讓 blocks→code 那個方向還原得回去
        // （`knowledge/concepts/降級與認知邊界.md`「降級前的身分」）。
        this.identityBeforeDowngrade.set(node.id, node.componentId)
        node.componentId = downgrade.componentId
      }
      // If no downgrade mapping or target also not visible → keep original (never raw_code)
    }

    // Recurse into children
    for (const children of Object.values(node.children)) {
      if (Array.isArray(children)) {
        for (const child of children) {
          this.downgradeComponentsForLevel(child, visible)
        }
      }
    }
  }

  /** Convenience: trigger blocks→code sync from external code (e.g., app.ts) */
  syncBlocksToCode(tree?: SemanticNode, blockMappings?: BlockMapping[]): void {
    const t = tree ?? this.currentTree
    if (!t) return
    this.handleEditTree({ viewId: 'blockly-panel', tree: t, blockMappings })
  }

  /**
   * Resync both panels after a topic/branch change.
   * - depth 0: blocks show body-only (scaffold stripped), code shows full (scaffold-wrapped)
   * - depth 1+: blocks show full tree, code shows full
   * When switching FROM depth 0 TO deeper, re-lifts from code to recover full tree.
   */
  // ⚠️ **非同步**（2026-08-26， 改成 Promise 之後）。
  //    三個呼叫點（`app.ts:770/771/773`）都是 fire-and-forget，回傳值沒有人接。
  async resyncForTopic(extractedTree: SemanticNode, currentCode: string): Promise<void> {
    if (this.syncing) return
    this.syncing = true
    try {
      let fullTree = extractedTree

      // If switching TO L1/L2 and tree has no main func (body-only from L0),
      // re-lift from the current code to get the full tree
      const hasMainFunc = (extractedTree.children.body ?? []).some(
        n => isFunctionDefinition(n.componentId) && n.properties.name === 'main'
      )
      if (this.getScaffoldDepth() > 0 && !hasMainFunc && this.lifter && this.parser) {
        const parseResult = await this.parser.parse(currentCode)
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
        const visible = getVisibleComponents(this.currentTopic, this.enabledBranches)
        downgradedTree = this.cloneTree(fullTree)
        this.downgradeComponentsForLevel(downgradedTree, visible)
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

  /**
   * Convenience: trigger code→blocks sync from external code (e.g., app.ts)
   *
   * ⚠️ **非同步**（2026-08-26）——`handleEditCode` 要 `await` 解析。
   * 七個呼叫點都是 fire-and-forget（回傳值沒有人接），而**組裝點要接**：
   * 它在同步完成之後才補相依、清旗標。
   */
  async syncCodeToBlocks(code?: string): Promise<boolean> {
    if (!this.lifter || !this.parser) return false
    if (code !== undefined) {
      await this.handleEditCode({ code })
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
    if (original !== undefined && node.componentId === abstractComponentOf(original)) {
      node.componentId = original
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

  // 🪦 **`getMappingForNode` 已於 2026-08-26 刪除——它是那張中央對映表的殘骸。**
  //
  //    它回傳 `{ blockId, startLine, endLine }`——**一次回答兩個視圖的座標**，
  //    而那正是 `execution:at-node` 那一刀要拆掉的東西：
  //
  //    > **執行器同時說了兩遍，因為它知道有兩個視圖。**
  //
  //    ⚠️ 而刪它的理由不是「重構完了」，是**它今天零個消費者**（實測）：
  //    收攏成 `execution:at-node` 廣播之後，每個視圖自己查自己那一維
  //    （程式碼視圖用下面的 `codeRangeForNode`，只回程式碼那一維）。
  //
  // > **一個「一次回答所有視圖」的查詢，它的存在本身就是那張中央對映表。**

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
