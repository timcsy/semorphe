import { generateExpressionCode, isUngeneratable, UNGENERATABLE_PREFIX } from '../../core/projection/code-generator'
import type { StylePreset } from '../../core/types'
import * as Blockly from 'blockly'
import { healingDragStrategy, immovableDragStrategy } from './ghost-drag-strategy'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import { companionFor } from '../../core/component/companion-blocks'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { DEGRADATION_VISUALS, CONFIDENCE_VISUALS } from '../../core/category-colors'
import { formatMessage } from '../../i18n/messages'
import type { BlockStylePreset } from '../../languages/style'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent, ExecutionAtNodeEvent, DiagnosticsEvent, EditableSource } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'
import { PatternExtractor } from '../../core/projection/pattern-extractor'
import type { BlockState as ExtractorBlockState } from '../../core/projection/pattern-extractor'
import { showToast } from '../toolbar/toast'
import { diagNote } from '../../core/diag-log'
import type { BlockMapping } from '../../core/projection/code-generator'
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
  /**
   * 怎麼建「程式」這個根節點——🔴 **由組裝點提供**（spec 153）。
   *
   * 原本是視圖層直接 import `components/cpp/program/lift` 的 `buildProgram`
   * ——而**根節點長什麼樣是語言的知識**。
   */
  buildProgramRoot?: (body: SemanticNode[]) => SemanticNode
  /**
   * 裝上抽取策略——🔴 **建構時就執行**（spec 153）。
   *
   * 原本是面板自己 `registerCppExtractStrategies(...)`；改成選項之後
   * **哪些策略要裝不再是視圖層的知識**，而**時機沒有變**
   * ——⚠️ 那很重要：這個專案撞過「機制有了沒人接上」四次，
   * 而改成事後呼叫會開一個「還沒裝」的窗口。
   */
  installExtractStrategies?: (extractor: PatternExtractor) => void
}

export class BlocklyPanel implements ViewHost {
  readonly viewId = 'blockly-panel'
  readonly viewType = 'blockly'
  readonly capabilities: ViewCapabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: ['control_flow', 'introduces_scope'],
    /** 積木＝**它們怎麼被擺在一起**——`concepts/理解的層次.md` */
    layer: 'space' as const,
  }

  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: (() => void) | null = null
  private onBlockSelectCallback: ((blockId: string | null) => void) | null = null
  private onNodeSelectCallback: ((nodeId: string | null) => void) | null = null
  private blockSpecRegistry: BlockSpecRegistry | null = null
  private currentRenderer: string = 'zelos'
  /**
   * 🔴 **匯流排造成的積木變動，用【事件群組】標記——不用旗標。**
   *
   * ## 為什麼旗標是錯的（2026-08-19 實測）
   *
   * 這裡本來是 `busUpdateInProgress = true / finally = false`，而 Blockly 的
   * 事件是**非同步**發的：
   *
   * ```js
   * requestAnimationFrame(() => { setTimeout(fireNow, 0) })   // blockly_compressed.js
   * ```
   *
   * 於是同步窗口結束時**一個事件都還沒到**，旗標早就關回 false 了：
   *
   * ```
   * 同步窗口結束時，聽到的事件數：0
   * 一個 tick 之後：            2   ← 兩則都看到旗標是 false
   * ```
   *
   * 🔴 **那個守衛從蓋好的那天起就沒擋到過任何東西。** 症狀是每一次
   * 「程式碼→積木」都被當成使用者編輯 → 反手寫回文件 → **多一個復原項**，
   * 而使用者按 Cmd+Z 還原到的是一個他沒有做過的狀態。
   *
   * > **一個押在「事件同步送達」上的守衛，在事件非同步的系統裡
   * > 與沒有守衛完全一樣——而它讀起來像有守衛。**
   *
   * ## 處置：讓守衛【跟著事件走】
   *
   * `Blockly.Events.setGroup()` 標在事件**建立**的當下，而群組會跟著事件
   * 穿過佇列（實測：反序列化的兩則都帶群組，使用者手拉的那顆不帶）。
   * 於是判斷不再問「現在是什麼時候」，而是問「**這則事件從哪來**」。
   */
  private static readonly BUS_GROUP = 'semorphe:bus-update'
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

  /**
   * 🔴 **最近幾則「被判成使用者編輯」的積木事件。**
   *
   * 2026-08-19 使用者回報：Cmd+Z 之後 `int x;` 跑到檔案最後。診斷的寫入
   * 紀錄證明了那一行是**積木面板寫回去的**（鏡像 6 個非空白行 → 寫成 7 行），
   * 而在那之前一筆算出來的是**空的**（被安全網擋下）。
   *
   * ⚠️ 但日誌只記了**寫了什麼**，沒記**是誰叫它寫的**——於是查到這裡就斷了：
   * 三條假設（載入沒清空／Blockly 復原堆疊／反序列化觸發回呼）全部實測排除，
   * 而症狀仍然在。
   *
   * > **一份只記錄「發生了什麼」而不記錄「因為什麼」的日誌，
   * > 能證明你的假設是錯的，不能告訴你哪個假設是對的。**
   *
   * 保留最後 12 則就夠——問題發生時要看的是**緊接在那次寫入之前**的那幾則。
   */
  private readonly recentEvents: string[] = []
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
  /**
   * 🔴 **沒有預設值**（spec 153）——原本是 `apcsStyle`，
   * 而那讓視圖層 import 了一個語言套件的檔案（P9 第一項）。
   *
   * ⚠️ 而它從來不是真的預設：`app.ts:218` 在建好之後**立刻**
   * `setCodeContext('cpp', DEFAULT_STYLE)`。那個「預設」只活了幾行。
   *
   * > **一個立刻被覆蓋的預設值，買到的是耦合，不是安全。**
   */
  private codeStyle: StylePreset | null = null

  /**
   * 建程式根節點——⚠️ **省略時退回一個空殼**，而那會讓抽取回來的樹沒有根。
   * 🟢 組裝點一定會傳（`app.ts`），這個退路只是為了讓面板單獨建得起來。
   */
  private buildProgramRoot: (body: SemanticNode[]) => SemanticNode =
    (body) => ({ id: 'program', componentId: 'program', properties: {}, children: { body } } as SemanticNode)

  /**
   * 抽取策略由**組裝點**裝上（spec 153）。
   *
   * 🔴 原本是面板自己 `registerCppExtractStrategies(...)`——**哪些策略要裝
   * 不是視圖層的知識**（P9）。⚠️ 而時機從「面板建構時」變成
   * 「app 初始化時」，所以它必須在第一次 `extract` 之前被呼叫。
   */
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
    options.installExtractStrategies?.(this.patternExtractor)
    this.media = options.media
    if (options.language !== undefined) this.codeLanguage = options.language
    if (options.style !== undefined) this.codeStyle = options.style
    if (options.buildProgramRoot) this.buildProgramRoot = options.buildProgramRoot
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — actual init handled by init() method
  }

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    // 🔴 **跳過的是「我自己改的」，不是「某個視圖改的」**（2026-08-27）。
    //
    // 在此之前這裡的條件是 `source === 'code' || source === 'resync'`
    // ——而 `source: 'blocks'` 一直被當成「樹被某個視圖改了」。
    // 流程面板 2026-08-26 也開始送 `edit:tree` 之後，**積木把它的編輯認成自己的**：
    // 使用者在流程改一個變數名，程式碼與流程都變了，而積木上還寫著舊名字。
    //
    // > **一個用「哪一類視圖」判斷來源的條件，
    // > 在第二個同類視圖出現的那天會把別人的編輯當成自己的。**
    //
    // ⚠️ 而**不能改成「一律重畫」**：重畫自己的編輯會打斷拖曳、清掉復原堆疊
    //    （下面那整段就是在處理這件事）。要跳過的只有**我自己**發的那一次。
    const mine = event.originViewId !== undefined && event.originViewId === this.viewId
    if (!mine && event.blockState) {
      diagNote(`🔄 重畫 ← ${event.source}｜重畫前頂層 ${this.workspace?.getTopBlocks(false).length ?? 0} 顆｜復原堆疊 ${this.workspace?.getUndoStack().length ?? 0} 項`)
      const prevGroup = Blockly.Events.getGroup()
      Blockly.Events.setGroup(BlocklyPanel.BUS_GROUP)
      // 🔴 **重畫過程中【產生】的事件，一律不得進復原堆疊。**
      //
      // ⚠️ 光靠底下的 `clearUndo()` 不夠——它是**同步**清的，而 Blockly 的事件
      //    走 `requestAnimationFrame → setTimeout(0)`，排隊中的那些會落在
      //    清空**之後**，於是復原堆疊又有東西了。這是同一個非同步陷阱的第二層。
      //
      // 🟢 `recordUndo` 與 `group` 一樣是在**事件建立的當下**抓住的
      //    （`this.recordUndo = getRecordUndo()`），所以它跟著事件走，
      //    不管那則事件多久以後才發出來。
      //
      // > **要擋一件「稍後才發生」的事，旗標必須蓋在【它被造出來的當下】，
      // > 不能蓋在「現在」。**
      const prevRecord = Blockly.Events.getRecordUndo()
      Blockly.Events.setRecordUndo(false)
      this.recordUndoWindowOpen = true
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
        // Sync blockMappings from render result so block→nodeId lookup works
        const blockState = event.blockState as { blockMappings?: BlockMapping[] }
        if (blockState.blockMappings) {
          this._blockMappings = blockState.blockMappings
        }
        // Force render after setState — dynamic blocks may not auto-render
        // ⚠️ **這一行必須在群組【裡面】**：它會 `initSvg`／`render` 每一顆積木，
        //    而那些也會發事件。舊寫法把它放在 `finally` 之後，等於明著漏在守衛外。
        this.forceRenderAllBlocks()
        // ─────────────────────────────────────────────────────────────
        // 🔴 **重畫之後，積木那側的復原歷史指向的是一個不存在的世界。**
        //
        // 2026-08-19 使用者實測（Arduino IDE，診斷的事件紀錄指名了它）：
        // 在 `setup()` 裡寫 `int x = 1;`，按兩次 Cmd+Z，得到
        //
        // ```cpp
        // void setup() { }
        // void loop()  { }
        // int x;              ← 跑到最外層
        // int x;              ← 而且兩顆，`= 1` 不見了
        // ```
        //
        // 診斷印出來的是 `create｜cpp_var_declare｜頂層 2 顆` 接三則 `move`
        // ——**那是 Blockly 自己的復原在重放事件**（焦點在面板上時 Cmd+Z 走這條）。
        //
        // 實測的因果：
        //
        // ```
        // ① 使用者親手拉過一顆積木  → 復原堆疊 1 項
        // ② 從程式碼重畫            → 復原堆疊【仍然 1 項】  ← 沒有人清它
        // ③ 按一次復原              → create｜cpp_var_declare  憑空長回來
        // ```
        //
        // 那顆積木屬於**重畫之前的那個工作區**。重放它等於把一個
        // 已經不存在的過去接回現在的畫布上，而自動同步再把它寫進檔案
        // ——`int x;` 落在最後，是因為它是一顆**孤兒**（沒有父積木）。
        //
        // > **一個被重畫過的視圖，它的復原歷史描述的是另一份真相；
        // > 重放那份歷史不是「還原」，是【把兩個世界混在一起】。**
        //
        // ⚠️ **代價說清楚**：重畫之後，面板上的 Cmd+Z 不再能還原更早的積木編輯。
        //    而在自動模式下重畫本來就很頻繁，**文件那側的復原才是使用者真正在用的**
        //    ——用「少一段拿不回來的積木歷史」換「檔案不會被寫壞」。
        // ─────────────────────────────────────────────────────────────
        this.workspace?.clearUndo()
        this.hasRendered = true
        // ⚠️ **`recordUndo` 不在這裡還原**——見 `endRecordUndoWindow`：
        //    有 mutator 的積木，形狀更新被 Blockly 延到下一幀才做。
        this.endRecordUndoWindow(prevRecord)
        Blockly.Events.setGroup(prevGroup)
      }
    }
  }

  /**
   * 🔴 **把「不記復原」的窗口延到 Blockly 的下一幀之後才關。**
   *
   * ## 為什麼同步關掉不夠
   *
   * 2026-08-19 的時間軸（0.8.7，使用者逐字確認第 6 則是「按了 Cmd+Z」）：
   *
   * ```
   * 5｜ +816ms｜🔄 重畫｜重畫前復原堆疊 0 項
   * 6｜+2893ms｜▫️ create cpp_var_declare｜頂層 2 顆   ← Cmd+Z 按在這裡
   * ```
   *
   * **重畫之後堆疊是 0，而 Cmd+Z 仍然造得出一顆積木**
   * ——所以有東西在重畫**之後**才進了堆疊。
   *
   * `setRecordUndo(false)` 蓋得住**同步窗口裡建立**的事件，而
   * `cpp_var_declare` 這種有 mutator 的積木，它的形狀更新會被 Blockly
   * 延到下一幀才做，那時窗口早就關了。
   *
   * ⚠️ 而復原一個 **mutation 變更**會讓積木**重建輸入**——掛在上面的
   * 初始值子積木就掉了。使用者看到的 `int x = 1;` 變成 `int x;`
   * 正是這個形狀，而積木在重建的過程中脫落成頂層的孤兒。
   *
   * ## 為什麼是「延後關窗」而不是「延後清空」
   *
   * 先寫的是延後 `clearUndo()`，**而護欄當場紅了**：那一刻使用者若剛好動了
   * 積木，他的動作會被一起清掉——**清空分不出那一項是誰放的**。
   *
   * > **要擋一件「稍後才發生」的事，蓋章要蓋在【它被造出來的當下】；
   * > 事後清掃分不出哪一項是你要清的。**
   *
   * 🟢 `recordUndo` 正是創建時蓋的章。窗口只延一幀（約 16 ms），
   * 而人在那之內不可能完成一個手勢。
   *
   * ⚠️ **重入**：期間又來一次重畫的話，**後來的那次說了算**——用 token 比對，
   * 否則先排的那個會提早把窗口關掉。
   */
  private recordUndoToken = 0
  private recordUndoWindowOpen = false

  /**
   * 重畫的「不記復原」窗口現在開著嗎。
   *
   * 🔴 **這是為了讓護欄【問狀態】而不是【等時間】**（2026-08-20）。
   *
   * 那支護欄原本靠 `await tick()`（固定 60ms）推論窗口開了沒——
   * 而窗口是 `requestAnimationFrame → setTimeout(0)` 關的，
   * **機器一忙 60ms 就不夠**，於是它一個 session 裡紅了四次。
   *
   * > **一支看不見它要測的狀態的測試，只能靠猜時間——而猜會在忙的時候猜錯。**
   *
   * ⚠️ 這**不是**為了測試而加的後門：它是一個**真的存在的狀態**，
   * 而在此之前它只活在兩個區域變數裡。把它變成可讀的，
   * 產品端一行行為都沒變。
   */
  isRedrawWindowOpen(): boolean {
    return this.recordUndoWindowOpen
  }

  private endRecordUndoWindow(prev: boolean): void {
    this.recordUndoToken += 1
    const mine = this.recordUndoToken
    const close = (): void => {
      // 期間又重畫過 → 那一次會自己關，這裡不能搶著關。
      if (mine !== this.recordUndoToken) return
      Blockly.Events.setRecordUndo(prev)
      this.recordUndoWindowOpen = false
      const n = this.workspace?.getUndoStack().length ?? 0
      // 🔴 **會出聲**：真的清到東西時記進時間軸。沒有它，
      //    「修好了」與「從來沒壞過」長得一樣。
      if (n > 0) diagNote(`🧹 關窗時堆疊仍有 ${n} 項——那不該發生`)
    }
    try {
      requestAnimationFrame(() => setTimeout(close, 0))
    } catch {
      setTimeout(close, 0)
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
        // 🔴 **手勢結束的保險絲。** 正常情況下拖曳結束後還會來一則 `move`
        //    （不在拖曳中），那一則就把累積的變動寫掉了。
        //    ⚠️ 而「正常情況下」不是保證——放開時若沒有位移，可能一則都沒有，
        //    於是使用者的那一步**永遠不會被寫進檔案**（比多寫一次糟得多）。
        if (event.type === Blockly.Events.BLOCK_DRAG
            && (event as unknown as { isStart?: boolean }).isStart === false
            && this.pendingDragChange) {
          setTimeout(() => this.userChanged(), 0)
        }
        // Track block selection (click events)
        if (event.type === Blockly.Events.SELECTED) {
          const selectEvent = event as Blockly.Events.Selected
          const selectedBlockId = selectEvent.newElementId ?? null
          this.onBlockSelectCallback?.(selectedBlockId)
          // 🔴 **選到東西才往外送**（2026-08-30）。
          //
          // Blockly 對「點了工作區外面」（分頁按鈕、工具列…）的反應也是
          // 一次 `SELECTED(null)`——而那個 `null` 一路清掉**每一個視圖**的反白。
          // 使用者：「切換到流程的 tab 會全部取消選取」。
          //
          // > **`null` 在這個事件裡有兩個意思：「使用者取消選取了」
          // > 與「焦點離開了這個工作區」——而它們長得一模一樣。**
          //
          // 🟢 而 Blockly **自己分得出來**：真正的「點空白處」會另外發一個
          //    `CLICK` 且 `targetType === 'workspace'`。取消選取因此改由
          //    下面那一段負責——那是一個**明確的動作**。
          if (selectedBlockId) {
            this.onNodeSelectCallback?.(this.getNodeIdForBlockId(selectedBlockId))
          }
        }
        // 🔴 **點在工作區的空白處＝明確的取消選取**——見上面那段的說明。
        if (event.type === Blockly.Events.CLICK
            && (event as unknown as { targetType?: string }).targetType === 'workspace') {
          this.onNodeSelectCallback?.(null)
        }
        return
      }
      // 🔴 **使用者親手拉出一顆積木時，順帶長出它宣告的伴生積木。**
      //
      // ⚠️ 帶著匯流排群組的事件是**反序列化**（程式碼→積木、還原、載入存檔）
      //    ——那些來源的伴生積木本來就在原文裡，再長一顆就是憑空多出來的一行。
      //    漏掉這個判斷的症狀是：**貼一次程式碼，`setup` 裡就多一份 `pinMode`。**
      //
      // 🔴 這裡本來問的是一個旗標，而**那個旗標從來沒有為真過**
      //    （Blockly 非同步發事件，見 `BUS_GROUP` 的檔頭）。
      //    所以上面那個症狀不是假設——它一直在發生。
      const fromBus = event.group === BlocklyPanel.BUS_GROUP
      if (!fromBus) {
        const id = (event as { blockId?: string }).blockId
        const type = id ? (this.workspace?.getBlockById(id)?.type ?? '已消失') : '—'
        // ⚠️ **群組要印出來**：使用者從工具箱拉一顆積木，它的 create 與後續的
        //    move 會共用一個隨機群組；程式造出來的通常沒有群組。
        //    那是「這是人做的還是程式做的」目前唯一分得出來的線索。
        const g = event.group ? event.group.slice(0, 6) : '（無）'
        // 🔴 **「事件自己的群組」與「現在的全域群組」是兩件事。**
        //    使用者拖曳時 Blockly 會 `setGroup(true)`，手勢結束時 `setGroup(false)`。
        //    ⚠️ 若手勢**沒有正常結束**（webview 裡失去指標捕捉就會），
        //    全域群組會**卡住**，而之後每一則事件都被歸進那個手勢
        //    ——於是一次 Cmd+Z 會把整組一起復原（Blockly 的 undo 會把
        //    同群組的項目全部彈出來）。
        //    這個讀數是分辨那件事的唯一線索。
        const live = Blockly.Events.getGroup()
        const liveNote = live ? `｜⚠️ 全域群組仍是 ${String(live).slice(0, 6)}` : ''
        const drag = this.workspace?.isDragging() ? '｜拖曳中' : ''
        const note = `▫️ 積木事件 ${event.type}｜${type}｜頂層 ${this.workspace?.getTopBlocks(false).length ?? 0} 顆｜群組 ${g}${liveNote}${drag}`
        this.recentEvents.push(note)
        while (this.recentEvents.length > 12) this.recentEvents.shift()
        diagNote(note)
      }
      if (!fromBus && event.type === Blockly.Events.CREATE) {
        this.growCompanion((event as Blockly.Events.BlockCreate).blockId)
      }
      if (!fromBus) {
        // ─────────────────────────────────────────────────────────────
        // 🔴 **拖曳過程中不寫檔案——放下之後才寫一次。**
        //
        // 2026-08-19 兩份時間軸拼起來（使用者在 Arduino IDE 實測）：
        //
        // ```
        // 面板  4｜+6807ms｜create cpp_var_declare｜群組 CGnb*)｜🔴 拖曳中
        //       5｜   +2ms｜✏️ 6 → 8 行           ← 寫入①（積木還飄在頂層）
        //       7｜ +635ms｜move｜頂層 1 顆        ← 接上去了
        //       8｜   +2ms｜✏️ 8 → 7 行           ← 寫入②
        // 宿主  5｜📝 文件變了（復原，版本 4，8 行）→ 送出   ← 使用者的 Cmd+Z
        // ```
        //
        // **一次拖曳產生兩次寫入，而它們各自是編輯器裡的一個復原項。**
        // 於是 Cmd+Z 還原到的是「拖到一半」的那個中間狀態
        // ——`int x;` 同時出現在 `loop` 裡和最外層，**而使用者從來沒看過它**。
        //
        // > **一個復原步驟的邊界，應該落在【使用者認為自己做完一件事】的地方。
        // > 把過程中的每一幀都存成一步，等於逼他倒著走過自己沒有走過的路。**
        //
        // ⚠️ 這不是同步壞了：回音正確擋掉、復原正確送出、積木正確重畫。
        //    壞的是**寫入的時機**。
        //
        // 🟢 落地：拖曳中只記「有事情要寫」，不寫；下一則不在拖曳中的事件
        //    把它一次寫掉。⚠️ 最後一則 `move` 本來就在拖曳結束之後才到，
        //    所以不需要另外監聽手勢結束。
        // ─────────────────────────────────────────────────────────────
        this.userChanged()
      }
    })
  }

  /**
   * 長出伴生積木。
   *
   * ⚠️ **核心不認得任何積木型別**——宣告從膠囊來（`companion-blocks.ts`）。
   *
   * 🔴 三種情況**什麼都不做**，而它們都是刻意的：
   *
   * ```
   * 沒有宣告        絕大多數積木——這條路對它們是零成本
   * 找不到目標函式   空白畫布上沒有 setup。⚠️ 硬長一顆 setup 出來會蓋掉
   *                 使用者正在組的東西——**寧可不長，不要亂長**
   * 已經有一顆了     使用者自己拉過 pinMode 了，不重複
   * ```
   */
  private growCompanion(blockId: string | undefined): void {
    if (!blockId || !this.workspace) return
    const trigger = this.workspace.getBlockById(blockId)
    if (!trigger) return
    const spec = companionFor(trigger.type)
    if (!spec) return

    const name = trigger.getFieldValue(spec.bind.fromField)
    if (!name) return

    // 目標函式的主體。找不到就不長——見上面的第二種情況。
    const target = this.workspace
      .getTopBlocks(false)
      .find(
        (b) =>
          b.type === spec.intoFunction.blockType &&
          b.getFieldValue(spec.intoFunction.nameField) === spec.intoFunction.name,
      )
    const body = target?.getInput(spec.intoFunction.bodyInput)?.connection
    if (!body) return

    // 已經有一顆綁同一個名字的伴生積木了嗎
    const already = this.workspace
      .getAllBlocks(false)
      .some(
        (b) =>
          b.type === spec.companion &&
          b.getInputTargetBlock(spec.bind.toInput)?.getFieldValue(spec.bind.refField) === name,
      )
    if (already) return

    try {
      const companion = this.workspace.newBlock(spec.companion)
      companion.initSvg()
      const ref = this.workspace.newBlock(spec.bind.refBlock)
      ref.initSvg()
      ref.setFieldValue(name, spec.bind.refField)
      companion.getInput(spec.bind.toInput)?.connection?.connect(ref.outputConnection)
      for (const [input, k] of Object.entries(spec.constants)) {
        const konst = this.workspace.newBlock(k.blockType)
        konst.initSvg()
        konst.setFieldValue(k.value, k.field)
        companion.getInput(input)?.connection?.connect(konst.outputConnection)
      }
      // 接在主體的**最後**——⚠️ 接在最前面會插到使用者已經寫好的東西前面
      let tail = body.targetBlock()
      while (tail?.getNextBlock()) tail = tail.getNextBlock()
      if (tail) tail.nextConnection?.connect(companion.previousConnection)
      else body.connect(companion.previousConnection)
      companion.render()
      this.workspace.render()
    } catch (err) {
      // ⚠️ **不吞掉**——一個安靜失敗的自動化，使用者只會看到「它有時候不長」。
      console.error('[semorphe] 伴生積木長不出來', err)
    }
  }

  /** 工作區是不是殘的。🔴 為真時「積木→程式碼」必須停手。 */
  get isStateStale(): boolean {
    // 🔴 **還沒被匯流排畫過一次的工作區，也是「殘的」。**
    //
    // 2026-08-19 的時間軸抓到（Arduino IDE，第 2 則）：
    //
    // ```
    // 1｜   +0ms｜📄 宿主送來文件｜版本 1｜10 行
    // 2｜ +125ms｜⛔ 擋下：6 → 0 行（少了 6）    ← 積木那側算出【空的】
    // 5｜ +816ms｜🔄 重畫 ← code｜重畫前頂層 0 顆  ← 積木這時才第一次載入
    // ```
    //
    // 文件在 +0ms 就到了，而第一次重畫在 +941ms。**那中間的工作區是空的**
    // ——而自動同步在 +125ms 就拿它去寫檔案，差點把整份 sketch 清成 0 行。
    // 是安全網擋下來的，⚠️ 而安全網只擋「少一半以上」，**少一點的擋不住**。
    //
    // > **一個「還沒被載入過」的視圖，與一個「內容真的是空的」視圖，
    // > 在讀取端長得一模一樣——差別只有它自己知道。**
    //
    // 🟢 這與 `host-no-overwrite`（擋「用舊存檔蓋掉」）和安全網（擋「用空狀態
    //    蓋掉」）是同一條性質的第三半：**擋「用還沒載入的狀態蓋掉」**。
    return this.staleReason !== null
  }

  /**
   * **殘的理由**——兩種殘要分得出來，因為**它們該對使用者說的話不一樣**。
   *
   * ```
   * 'load-failed'   真的載壞了      → 要出聲：畫面上的積木不是完整的
   * 'not-rendered'  還沒畫過（開機） → 【不要】出聲：那是正常的過渡狀態
   * ```
   *
   * 🔴 使用者 2026-08-24：「**我每次重新整理下面都會跳出一條這個**，
   * 我覺得這會讓使用者有誤會，以為剛開啟的時候系統錯誤。」
   *
   * 那條紅字寫著「積木沒有完整載入」——而積木完整得很，它只是**還沒畫**。
   *
   * > **一個把「還沒發生」講成「失敗了」的訊息，
   * > 每一次正常開機都在教使用者不要相信錯誤訊息。**
   *
   * ⚠️ **擋寫回這件事兩種都要擋**（`isStateStale` 仍然兩種都為真）——
   * 分開的是「說什麼」，不是「擋不擋」。
   */
  get staleReason(): 'load-failed' | 'not-rendered' | null {
    if (this.stateLoadFailed) return 'load-failed'
    if (!this.hasRendered) return 'not-rendered'
    return null
  }

  /** 手勢／編輯進行中累積的變動——結束之後補寫一次。見 `userChanged`。 */
  private pendingDragChange = false

  /** 等「忙完」的輪詢。⚠️ 只在有待寫的東西時存在。 */
  private flushTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 🔴 **使用者正在「做一件事」的中途，不寫檔案。**
   *
   * ## 兩個實測到的形狀，同一個病
   *
   * ```
   * 拖曳    一次拖曳產生兩次寫入 → ⌘Z 回到「拖到一半」（積木在最外層）
   * 改欄位  把 x 改成 y 產生兩次寫入 → ⌘Z 第一次得到 `int ;`
   * ```
   *
   * 第二個是 2026-08-19 使用者按第 1 條驗收時抓到的：
   * **欄位被清空的那一瞬間也被寫進了檔案**。於是 `int y;` 要按兩次 ⌘Z
   * 才回得去，而中間那一步是 `int ;`——**一個他從來沒有輸入過的狀態**。
   *
   * > **一個復原步驟的邊界，應該落在【使用者認為自己做完一件事】的地方。
   * > 把過程中的每一幀都存成一步，等於逼他倒著走過自己沒有走過的路。**
   *
   * ## 判準：畫布在拖，或欄位編輯器開著
   *
   * `WidgetDiv` 是文字欄位的編輯器，`DropDownDiv` 是下拉
   * ——⚠️ 兩個是**不同的容器**，只問一個會漏掉另一半。
   *
   * ## ⚠️ 為什麼需要輪詢，不能只等下一則事件
   *
   * 拖曳結束後通常還會來一則 `move`，那一則就把累積的寫掉了。
   * **而欄位編輯沒有這個保證**：最後一次值變更可能在編輯器關閉**之前**就發出，
   * 之後一則事件都沒有——那會讓使用者的修改**永遠不進檔案**（比多寫一次糟得多）。
   *
   * 🔴 所以要有人去看「忙完了沒有」。輪詢只在**有待寫的東西**時存在，忙完就自己收掉。
   */
  private userChanged(): void {
    if (this.isUserBusy()) {
      this.pendingDragChange = true
      this.scheduleFlush()
      return
    }
    this.pendingDragChange = false
    this.onChangeCallback?.()
  }

  private isUserBusy(): boolean {
    return this.workspace?.isDragging() === true
      || Blockly.WidgetDiv.isVisible()
      || Blockly.DropDownDiv.isVisible()
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return
    this.flushTimer = setInterval(() => {
      if (this.isUserBusy()) return
      if (this.flushTimer !== null) { clearInterval(this.flushTimer); this.flushTimer = null }
      if (!this.pendingDragChange) return
      this.pendingDragChange = false
      this.onChangeCallback?.()
    }, 120)
  }

  /** 匯流排畫過至少一次了嗎。⚠️ 見 `isStateStale`——沒畫過的工作區不得寫回。 */
  private hasRendered = false

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

  /** 最近幾則被判成使用者編輯的積木事件——**診斷用**，見 `recentEvents` 的檔頭。 */
  get recentUserEvents(): readonly string[] {
    return this.recentEvents
  }

  /**
   * 積木那側的復原堆疊還剩幾項。
   *
   * 🔴 **重畫之後它必須是 0。** 非 0 代表舊世界的歷史還在，而重放它會把
   * 一個不存在的過去接回畫布（`history/087`）。
   */
  get undoDepth(): number {
    return this.workspace?.getUndoStack().length ?? 0
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

  /**
   * **契約那一支**（`ViewHost.readSource`）——積木這一側交的是**樹**。
   *
   * ⚠️ 它與下面那支 `extractSemanticTree()` 不是重複：後者是這個面板自己的方法，
   * 組裝點（`app.ts`）走它，因為那條路還要 `getBlockMappings()`／`staleReason`
   * ——**那是組裝點份內的事**（`history/167`）。
   * 契約這一支是給**不認識這個面板的消費者**用的。
   */
  readSource(): EditableSource {
    return { kind: 'tree', tree: this.extractSemanticTree() }
  }

  /** Extract semantic tree from workspace blocks, plus blockMappings for nodeId↔blockId */
  extractSemanticTree(): SemanticNode {
    if (!this.workspace) return this.buildProgramRoot([])
    this._blockMappings = []
    const topBlocks = this.workspace.getTopBlocks(true)
    const body: SemanticNode[] = []
    for (const block of topBlocks) {
      const nodes = this.extractBlockChain(block)
      body.push(...nodes)
    }
    return this.buildProgramRoot(body)
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

      // 🔴 **註解泡泡也要帶上**（2026-08-23）：這個函式是**手工**組出
      //    `BlockState` 的，而它原本只抄欄位、插槽與 `extraState`
      //    ——於是使用者寫的註解在「積木→程式碼」之後**安靜消失**。
      //    ⚠️ 症狀不是報錯，是**他打的字沒了**。
      const comment = block.getCommentText?.()
      if (comment) state.icons = { comment: { text: comment, pinned: false } }

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
          // Try simpleExpressionToCode for known components as statement
          const expr = this.simpleExpressionToCode(n)
          if (!isUngeneratable(expr)) return '    ' + expr + ';'
          return `    ⟨${n.componentId}⟩`
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
    // 🔴 **沒有風格就說不出程式碼**——而這是降級路徑，
    //    honest degradation：回一個看得出「這裡沒能產出」的記號，
    //    不要猜一個風格（P6：禁止給出一個看起來合理的結構）。
    // ⚠️ **用專案既有的「產不出來」標記**，不要自己寫註解語法
    //    ——第一版寫的是 `/* … */`，而**語法耦合護欄當場抓到**：
    //    那是 C 的註解記號，出現在視圖層。
    //    > **連「說不出來」都要用中立的說法。**
    if (!this.codeStyle) return `${UNGENERATABLE_PREFIX}尚未設定程式碼風格⟩`
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
    // 🔴 **積木側只用 `line`，不用 `column`**——它沒有「欄」這個概念。
    //
    // ⚠️ 而那個不對稱是**刻意的**，不是還沒做完：程式碼側的波浪本來就指得到
    // 確切位置，積木側能給的最有用的東西是「在第幾行」——它讓學生知道
    // 要往程式碼那一格的哪裡看。
    //
    // `humanLine` 是 1-based：`at.line` 與 tree-sitter 一致是 0-based，
    // **而換算屬於呈現，不屬於事實**。
    const params = d.at ? { ...d.params, humanLine: d.at.line + 1 } : d.params
    return formatMessage(`DIAG_${d.rule}_BLOCK`, params) ?? formatMessage('DIAG_UNKNOWN') ?? ''
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

      // 🔴 **「認不得的那一段」的視覺**（2026-08-26 從 `cpp_raw_code` 的命令式
      //    定義搬過來）。它本來寫在那顆積木的 `loadExtraState` 裡，而**這件事
      //    與語言無關**：任何積木的 `extraState.unresolved` 都該長成這樣。
      //
      // ⚠️ 而它與旁邊那兩段（降級／信心）**本來就是同一族**——只有它沒被搬。
      //
      // > **一個機制搬家的時候，留在原地的那一半會看起來像「它需要特別處理」。**
      if (extra.unresolved === true) {
        const nodeType = String(extra.nodeType ?? '')
        const tip = ((Blockly.Msg as Record<string, string>)['U_UNRESOLVED_TOOLTIP'] ?? 'Unresolved: %1')
          .replace('%1', nodeType)
        block.setTooltip(tip)
      }

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

      // Annotation 視覺——`extraState` 帶進來的註解灌進泡泡
      const annotations = extra.annotations as Annotation[] | undefined
      if (annotations?.length) {
        const inlineTexts = annotations
          .filter(a => a.position === 'inline' || a.position === 'after')
          .map(a => a.text)
        if (inlineTexts.length > 0) block.setCommentText(inlineTexts.join('\n'))
      }
    }
  }

  /** Mark blocks whose component is not in visibleComponents as semi-transparent */
  /**
   * **鷹架在積木上長什麼樣**——`ghost` 時淡的 ＋ 動不了。
   *
   * ## 🔴 它在 2026-08-28 之前完全不存在
   *
   * `ghost` 只在 **Monaco（程式碼側）**有實作（`.ghost-line`，opacity 0.4 ＋ 斜體），
   * 而積木這一側 `grep -rn ghost` 是**零筆**。
   *
   * 於是 `ghost` 與 `editable` 在積木上**視覺完全相同**——
   * 使用者 2026-08-28 看著畫面說「**淡的好像失效了**」。
   * 而它不是失效，是**從來沒做過**。
   *
   * > **一個模式如果在某個視圖上與另一個模式長得一樣，
   * > 那個視圖就沒有實作它——而選單仍然讓人選得到。**
   *
   * ⚠️ **「動不了」與「淡的」要一起**：只淡不鎖的話學生拖得動它，
   * 而拖動一顆「看起來不該碰」的東西之後，畫面說的話就變成假的。
   *
   * ⚠️ **判準吃的是 `blockId`，不是元件身分**——因為 `int main()` 這一塊
   * 是靠「**函式定義 ＋ 名字叫 main**」認出來的（`cpp-scaffold-filter.ts:20`），
   * 而那是**節點**的性質不是**元件**的性質。
   *
   * 🔴 第一版用 componentId 判斷，於是 `#include`／`using`／`return` 都標到了，
   * **而骨架最重要的那一塊 `int main()` 漏掉**。
   *
   * > **一個「這顆是不是鷹架」的判準，如果只看得到元件身分，
   * > 就答不出那些靠【自己的屬性】才成為鷹架的節點。**
   *
   * @param scaffoldNodeIds 這些**節點**屬於鷹架（組裝點走樹算的）
   * @param mode `ghost` 才處理；`editable` 還原成一般積木
   */
  /**
   * 🪦 **這裡曾經有一套「鷹架被連帶拖走就放回去」的事件監聽——三次都壞掉。**
   *
   * ```
   * ① 記「父節點」        拖走上面那塊時，鷹架的父節點【沒有變】 → 什麼都沒做
   * ② 記「該在誰肚子裡」   放回去的時候容器是空的 → return 0 整個消失
   * ③ …
   * ```
   *
   * 🔴 **根本問題是結構的**：`return 0` 在 Blockly 裡就是學生語句的**下一塊**，
   * 拖前面必然帶走它。用監聽器對抗框架，只會一直長出新的破口。
   *
   * > **同一個地方修三次而每次壞在不同的點，那是設計不對的訊號，
   * > 不是還沒補好。**
   *
   * 🟢 正解在**投影**那一層：`ghost` 模式下 `main` 裡面的鷹架**不畫出來**
   * ——拖不到，就不可能被帶走（見 `cpp-scaffold-filter.ts` 的 `ghost` 分支）。
   */
  /** 每一塊原本的拖曳策略——換回 `editable` 時要還原它。 */
  private originalDragStrategy = new Map<string, ReturnType<Blockly.BlockSvg['getDragStrategy']>>()

  /** 上一次 `markScaffoldBlocks` 收到的那一組——覆蓋要把骨架排除在外。 */
  private lastScaffoldIds: ReadonlySet<string> = new Set()

  /**
   * **這一次執行沒有跑到的積木，標出來。**
   *
   * 🔴 初學者的 bug 有壓倒性的比例是「**這一段從來沒跑到**」：`return` 後面的
   * 程式碼、永遠不成立的 `if`、根本沒進去的迴圈。而執行器已經知道它到過誰了
   * ——缺的只是把它畫出來。
   *
   * ⚠️ **骨架不算**：`int main()`／`return 0` 那幾塊是不是被走到，
   * 對學生沒有意義（而且鷹架模式下它們本來就不是他的東西）。
   *
   * ⚠️ **沒跑到 ≠ 錯**（見 CSS 的說明）：一個 `if` 的另一支本來就可能不該跑。
   * 這個標記是在**問一句**，不是在判對錯——所以回傳的數字給呼叫端去說那句話，
   * 這裡不決定文案。
   *
   * @returns 被標起來的積木數。
   */
  markNeverRan(visited: ReadonlySet<string>): number {
    if (!this.workspace) return 0
    const blocks = this.workspace.getAllBlocks(false)
    const never = new Set<string>()
    for (const block of blocks) {
      const nodeId = this.getNodeIdForBlockId(block.id)
      // ⚠️ 對不到節點的積木（剛拖進來還沒同步）不算——它不是「沒跑到」，
      //    它是「還沒進到樹裡」。把兩者混在一起會讓標記閃來閃去。
      if (nodeId === null || nodeId === undefined) continue
      // 🔴 **只看【語句】，不看運算式**（2026-09-04，截圖抓到的）。
      //
      //    一支**完全正確**的 `sum = sum + n;` 會被標兩塊——因為指定的
      //    **左邊那顆變數不走執行，它走 lvalue 解析**（`interpreter/lvalue.ts`
      //    的 `resolvePlace`），於是它從來不會進 `visited`。
      //
      // > **`visited` 記的是「執行器走過誰」，而那不等於「這一段跑了沒有」
      // > ——有些節點是被【解析】的，不是被【執行】的。**
      //
      //    而修法不在直譯器那側（再補一個記錄點，下一個非執行路徑仍會漏），
      //    在**粒度**：`return` 後面的程式碼、不成立的 `if`、沒進去的迴圈
      //    ——初學者的那三種 bug **全部是語句**。
      //
      // ⚠️ Blockly 的判準：有 `outputConnection` ＝ 它是一個值（運算式）。
      if (block.outputConnection) continue
      if (!visited.has(nodeId) && !this.lastScaffoldIds.has(nodeId)) never.add(block.id)
    }
    // 🔴 **只標最外層的那一塊**（2026-09-04 實測）：一句
    //    `cout << "never" << endl;` 在樹裡是三顆節點（輸出／字串／換行），
    //    三顆都標的話畫面上是三圈框，而主控台會說「有 3 塊沒跑到」
    //    ——**而學生眼裡那是一句話**。
    //
    // > **回饋的計數單位要跟使用者的知覺一致，不是跟資料結構一致。**
    let n = 0
    for (const block of blocks) {
      const svgRoot = (block as Blockly.BlockSvg).getSvgRoot?.()
      if (!svgRoot) continue
      const outermost = never.has(block.id)
        && !(block.getParent() !== null && never.has(block.getParent()!.id))
      svgRoot.classList.toggle('never-ran', outermost)
      if (outermost) n++
    }
    return n
  }

  /**
   * **把「這顆迴圈跑了幾輪」畫上去。**
   *
   * 🔴 這裡**只負責畫**——「哪一塊是迴圈」與「幾輪」都在 `core/iterations.ts`
   * 算好了（它讀元件的 `control_flow` 標註）。
   *
   * > **一個視圖如果自己推導教學上的判斷，那個判斷就會有第二份
   * > ——而兩份遲早會不同意。**
   *
   * @param times 迴圈**節點 id** → 跑了幾輪
   * @returns 標了幾塊
   */
  markIterations(times: ReadonlyMap<string, number>): number {
    if (!this.workspace) return 0
    this.clearIterations()
    let n = 0
    for (const block of this.workspace.getAllBlocks(false)) {
      const nodeId = this.getNodeIdForBlockId(block.id)
      if (nodeId === null || nodeId === undefined) continue
      const t = times.get(nodeId)
      if (t === undefined) continue
      this.drawIterationBadge(block as Blockly.BlockSvg, t)
      n++
    }
    return n
  }

  /**
   * 把 `×5` 畫在積木的**右上角**。
   *
   * ⚠️ 它是 SVG 裡的一個 `<text>`，不是 DOM 的浮層——浮層會在捲動與縮放時
   * 與積木脫節，而那個 bug 的樣子是「數字飄在別的積木上」。
   */
  private drawIterationBadge(block: Blockly.BlockSvg, times: number): void {
    const root = block.getSvgRoot?.()
    if (!root) return
    // 🪦 **第一版畫在 `width + 6`（右邊），而它飄在空白處**（2026-09-04 截圖）。
    //
    //    `getHeightWidth().width` 是整塊 C 形積木的寬——包含**身體裡最寬的那一句**。
    //    於是迴圈的標題列在 x=1260 結束，而數字落在 x=1387：
    //    中間隔著一段空白，看起來不像是在講那顆迴圈。
    //
    // > **一個標註如果離它在講的東西有一段空白，
    // > 使用者要自己連那條線——而他會連錯。**
    //
    // 🟢 改貼在**標題列的左邊**（`text-anchor: end`）：那一列就是
    //    「重複」那幾個字所在的那一列，兩者讀起來是同一句話。
    //
    // 🪦 **而第二版是純文字，內層那顆看不見**（同一天，同一張截圖的下一輪）。
    //
    //    琥珀色的字落在**橘色的迴圈積木**上——而迴圈正是這個功能
    //    **唯一會標的積木**。外層那顆落在深色畫布上，看得一清二楚；
    //    內層那顆落在外層的身體裡，等於沒有。
    //
    // > **一個只在「它旁邊剛好是背景色」時才看得見的標註，
    // > 在它最該出現的地方——巢狀的內層——正好看不見。**
    //
    // 🟢 所以給它一塊**深色底**：不管積木是什麼顏色都讀得到。
    //
    // 🪦 **而「貼在標題列左邊」也不對**（同一天的第三輪）。
    //
    //    巢狀的內層迴圈，它標題列的左邊**正好是父迴圈畫「執行」那兩個字的地方**
    //    ——量出來的座標是對的（905, 268），而畫面上被蓋掉了。
    //
    // > **一個位置如果只在「這一塊沒有被別人包住」時才空著，
    // > 那它在巢狀的情況下必然撞車——而巢狀正是這個功能最有用的時候。**
    //
    // 🟢 最後的形狀是**左邊的一條槽**：每顆迴圈的數字**垂直對齊自己那一列**，
    //    而水平上全部排在整塊程式的左邊（像行號）。撞不到任何東西，
    //    而且一眼看得出「這個 3 是在講這一列」。
    const label = `×${times}`
    const w = 9 + 7 * label.length
    // ⚠️ 巢狀的縮排要**扣回去**：內層積木的原點在父積木裡面，
    //    不扣的話它的槽會落在父積木身上（那正是上一版的病）。
    const here = block.getRelativeToSurfaceXY()
    const root0 = block.getRootBlock().getRelativeToSurfaceXY()
    const gutterX = root0.x - here.x - 10 - w
    const g = Blockly.utils.dom.createSvgElement('g', { class: 'iteration-badge' }, root)
    Blockly.utils.dom.createSvgElement('rect', {
      x: gutterX, y: 5, width: w, height: 16, rx: 4,
      class: 'iteration-badge-bg',
    }, g)
    const text = Blockly.utils.dom.createSvgElement('text', {
      class: 'iteration-badge-text', x: gutterX + w / 2, y: 17,
    }, g)
    text.textContent = label
  }

  /**
   * **把最外層的那幾句拆開、打散**——「排回去」那種題的畫面（文獻裡叫 Parsons problem）。
   *
   * ## 🔴 打散的是【語句】，不是每一塊積木
   *
   * 把 `cout << n << endl;` 拆成三塊（輸出／變數／換行）不是「排回去」，
   * 是拼圖——而學生要練的是**順序與結構**，不是把運算式重組回去。
   *
   * 同一條規矩在「執行覆蓋」那一刀定過一次：
   * **回饋的計數單位要跟使用者的知覺一致**，而學生眼裡一行就是一塊。
   *
   * ## ⚠️ 而鷹架那幾塊【不動】
   *
   * `#include`／`int main()` 是他沒有要排的東西（多數課它們還是淡的）。
   * 打散它們只會讓他去搬一堆與這一題無關的積木。
   *
   * @param order 由 `core/arrange.ts` 給的確定性順序——⚠️ **這裡不亂數**
   * @returns 打散了幾塊（0 ＝ 那一題等於直接給答案，呼叫端要出聲）
   */
  /** 鷹架標記填好了沒有——⚠️「排回去」那種題要等它（見 `scatterTopStatements`）。 */
  scaffoldMarked(): boolean {
    return this.lastScaffoldIds.size > 0
  }

  scatterTopStatements(order: readonly number[]): number {
    const ws = this.workspace
    if (!ws) return 0

    // 🔴 **只找「函式主體裡的那幾句」**：頂層的 `#include` 與 `main` 本身不算。
    //    判準是「它有前後接點、而且它的父積木是鷹架」——⚠️ 而「哪一塊是鷹架」
    //    問的是既有的那份（`lastScaffoldIds`），不是在這裡再判一次。
    const isScaffold = (b: Blockly.Block): boolean => {
      const nodeId = this.getNodeIdForBlockId(b.id)
      return nodeId !== null && nodeId !== undefined && this.lastScaffoldIds.has(nodeId)
    }

    const movable: Blockly.BlockSvg[] = []
    for (const b of ws.getAllBlocks(false) as Blockly.BlockSvg[]) {
      if (!b.previousConnection) continue          // 沒有前接點 ＝ 運算式，不是一句
      // 🔴 **不打散他搬不動的**——淡的鷹架（`return 0;`）本來就拖不動，
      //    打散它只會在畫面上多一塊他碰不到的東西。
      //    ⚠️ 而這個判準**不依賴時機**：`isMovable()` 是積木自己的狀態。
      if (!b.isMovable()) continue
      if (isScaffold(b)) continue                  // 同上的第二道（鷹架標記若已就緒）
      // 🔴 **`getSurroundParent()`，不是 `getParent()`**（2026-09-05 實測）。
      //
      //    Blockly 的 `getParent()` 回的是「**接在我上面的那一塊**」——在一疊
      //    語句裡，那是**上一句**，不是包住我的那一塊。用它判「我在哪一層」
      //    會得到一條鏈（第二句的 parent 是第一句），於是**每一句都被判成巢狀**
      //    ——實測：4 塊該打散的，一塊都沒打散。
      //
      // > **一個名字叫 `getParent` 的東西，回的不一定是你以為的那個「裡面」。**
      const around = b.getSurroundParent()
      if (!around) continue
      // ⚠️ 只取「函式主體的第一層」——巢狀迴圈【裡面】那幾句留在原地，
      //    否則一題會爆成二十塊，而那正是那些研究說會讓人放棄的形狀。
      //
      // 🪦 判準原本是「圍住我的那一塊是鷹架」，而**它依賴時機**：
      //    `lastScaffoldIds` 是同步之後才填的，在 +300ms 那一刻可能還是空的
      //    ——實測：分類全部正確，而打散是 0 塊。
      //
      // > **一個依賴「另一件事已經做完」的判準，
      // > 在它自己跑得比較快的那一天會安靜地全部落空。**
      //
      // 🟢 換成**結構**的判準：圍住我的那一塊自己沒有被圍住 ＝ 我在第一層。
      if (around.getSurroundParent() !== null) continue
      movable.push(b)
    }
    if (movable.length < 2) return 0

    // 拆下來
    for (const b of movable) b.unplug(true)

    // 依 `order` 擺——⚠️ 由外面給順序，**這裡一顆亂數都不產**
    const seq = order.filter((i) => i < movable.length)
    const rest = movable.map((_, i) => i).filter((i) => !seq.includes(i))

    // 🔴 **擺在骨架【下面】，不要疊上去**：疊在一起的第一印象是「壞了」，
    //    而學生第一件事會是把它們拖開——那是白花的力氣。
    let y = 20
    for (const t of ws.getTopBlocks(false) as Blockly.BlockSvg[]) {
      if (movable.includes(t)) continue
      y = Math.max(y, t.getRelativeToSurfaceXY().y + t.getHeightWidth().height + 24)
    }
    for (const i of [...seq, ...rest]) {
      const b = movable[i]
      const xy = b.getRelativeToSurfaceXY()
      b.moveBy(40 - xy.x, y - xy.y)
      y += b.getHeightWidth().height + 14
    }

    // 🔴 **打散完要看得到**——擺在骨架下面之後，它們多半在畫面外，
    //    而**看不到的積木等於沒有**：學生看到的是一個空掉的 `main`，
    //    畫面上與「這一題壞了」一模一樣。
    //
    // ⚠️ `zoomToFit` 而不是 `scrollCenter`：塊數多的時候光是置中還是塞不下。
    // ⚠️ **`catch` 不得是空的**（第某條護欄當場抓到我）：被吞掉的例外
    //    會變成「內容比較少的成功」——這裡真正會發生的是「沒有畫布」
    //    （測試環境），而那時打散仍然是有效的，只是沒有東西可以縮放。
    try {
      ws.zoomToFit()
    } catch (e) {
      console.warn('[arrange] 縮放到看得見失敗——積木已經打散了，而它們可能在畫面外', e)
    }
    return movable.length
  }

  /** 把上一次的次數標註清掉。⚠️ 與 `clearNeverRan` 同一條規矩：改了就過期。 */
  clearIterations(): void {
    if (!this.workspace) return
    for (const el of this.workspace.getParentSvg().querySelectorAll('.iteration-badge')) {
      el.remove()
    }
  }

  /** 把上一次的標記清掉——⚠️ 改積木之後那個標記就過期了。 */
  clearNeverRan(): void {
    if (!this.workspace) return
    for (const block of this.workspace.getAllBlocks(false)) {
      (block as Blockly.BlockSvg).getSvgRoot?.()?.classList.remove('never-ran')
    }
  }

  markScaffoldBlocks(scaffoldNodeIds: ReadonlySet<string>, mode: 'ghost' | 'editable'): void {
    this.lastScaffoldIds = scaffoldNodeIds
    if (!this.workspace) return
    const ghostBlockIds = new Set<string>()
    for (const block of this.workspace.getAllBlocks(false)) {
      const svgRoot = (block as Blockly.BlockSvg).getSvgRoot?.()
      if (!svgRoot) continue
      // 🔴 **反查住在面板裡**——組裝點只說「哪幾個節點」，不必知道積木 id
      const nodeId = this.getNodeIdForBlockId(block.id)
      const isScaffold = nodeId !== null && nodeId !== undefined && scaffoldNodeIds.has(nodeId)
      if (isScaffold && mode === 'ghost') {
        svgRoot.classList.add('ghost-block')
        // 🔴 **不用 `setMovable(false)`**——那個旗標會被連接判定讀去，
        //    於是學生的積木插不進 `main` 與 `return` 之間（實測）。
        //    「拖不動」由拖曳策略表達（見下面那一段）。
        block.setEditable(false)
      } else {
        svgRoot.classList.remove('ghost-block')
        // ⚠️ 只還原**我們鎖過的那些**——別的東西可能有自己的理由不能動
        if (isScaffold) block.setEditable(true)
      }
      if (isScaffold && mode === 'ghost') ghostBlockIds.add(block.id)
    }

    // 🔴 **會出事的是鷹架【上面】那一塊**，不是鷹架自己。
    //
    // 鷹架 `setMovable(false)` 已經拖不動了，而 Blockly 的語義是
    // 「拖一塊就帶走它下面接的一串」——所以要動手腳的是**前一塊**。
    //
    // 🟢 Blockly 本來就有這個語義（`shouldHealStack`：按著 Alt 拖曳時，
    //    後面那一串會接回原位）。這裡只是讓它在該 heal 的時候以為有按。
    // ⚠️ **只包住真的需要的那幾塊**——「它的 next 鏈裡有鷹架」的才換策略。
    //    對每一塊都動手腳的話，Blockly 之後的行為改動會在意想不到的地方冒出來。
    const needsWrap = (b: Blockly.Block): boolean => {
      for (let n = b.getNextBlock(); n; n = n.getNextBlock()) if (ghostBlockIds.has(n.id)) return true
      return false
    }
    for (const block of this.workspace.getAllBlocks(false)) {
      const b = block as Blockly.BlockSvg
      const orig = this.originalDragStrategy.get(b.id) ?? b.getDragStrategy()
      // 鷹架自己 → 拖不動；它上面那一塊 → 拖走時把它摘出來
      const isGhost = ghostBlockIds.has(b.id)
      const wrap = mode === 'ghost' && (isGhost || needsWrap(b))
      if (wrap && !this.originalDragStrategy.has(b.id)) this.originalDragStrategy.set(b.id, orig)
      if (wrap) {
        b.setDragStrategy(isGhost
          ? immovableDragStrategy()
          : healingDragStrategy(orig, (id) => ghostBlockIds.has(id), b))
      }
      else if (this.originalDragStrategy.has(b.id)) {
        b.setDragStrategy(this.originalDragStrategy.get(b.id)!)
        this.originalDragStrategy.delete(b.id)
      }
    }
  }

  markOutOfScopeBlocks(visibleComponents: Set<string>): void {
    if (!this.workspace || !this.blockSpecRegistry) return
    const allBlocks = this.workspace.getAllBlocks(false)
    for (const block of allBlocks) {
      const svgRoot = (block as Blockly.BlockSvg).getSvgRoot?.()
      if (!svgRoot) continue
      const spec = this.blockSpecRegistry.getAll().find(s => s.blockDef?.type === block.type)
      const componentId = spec?.componentMapping?.componentId
      // If block has no component (unknown/custom), treat as visible
      //
      // 🔴 **只掛類別，不要在這裡設 `opacity`**（2026-09-02）。
      //
      //    `svgRoot.style.opacity = '0.35'` 蓋在積木的 `<g>` 上，而 SVG 的
      //    `opacity` **會套用到整個子樹**——於是一顆超出範圍的 `setup`
      //    把裡面的註解、以及學生自己寫的積木**全部一起打暗**。
      //    使用者：「怎麼連註解也是淡的？」
      //
      // 🪦 這正是 2026-08-28 在**鷹架**那一層學過的同一課
      //    （`.ghost-block` 用直接子代選擇器），而**這一層沒有跟上**。
      //
      // > **同一個教訓在兩個地方各犯一次，第二次不是「又犯了」
      // > ——是第一次修的時候只修了看得到的那一半。**
      //
      // 🟢 淡成什麼樣交給 CSS（`.out-of-scope-block > …`），與鷹架同一種寫法。
      if (!componentId || visibleComponents.has(componentId)) {
        svgRoot.style.opacity = ''
        svgRoot.classList.remove('out-of-scope-block')
      } else {
        svgRoot.style.opacity = ''
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
