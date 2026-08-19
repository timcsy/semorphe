import { generateExpressionCode, isUngeneratable, UNGENERATABLE_PREFIX } from '../../core/projection/code-generator'
import type { StylePreset } from '../../core/types'
import apcsStyle from '../../languages/cpp/styles/apcs.json'
import * as Blockly from 'blockly'
import type { SemanticNode, BlockSpec, DegradationCause, ConfidenceLevel, Annotation } from '../../core/types'
import { createNode } from '../../core/semantic-tree'
import { companionFor } from '../../core/component/companion-blocks'
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
import { diagNote } from '../../core/diag-log'
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

  private endRecordUndoWindow(prev: boolean): void {
    this.recordUndoToken += 1
    const mine = this.recordUndoToken
    const close = (): void => {
      // 期間又重畫過 → 那一次會自己關，這裡不能搶著關。
      if (mine !== this.recordUndoToken) return
      Blockly.Events.setRecordUndo(prev)
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
        const note = `▫️ 積木事件 ${event.type}｜${type}｜頂層 ${this.workspace?.getTopBlocks(false).length ?? 0} 顆｜群組 ${g}`
        this.recentEvents.push(note)
        while (this.recentEvents.length > 12) this.recentEvents.shift()
        diagNote(note)
      }
      if (!fromBus && event.type === Blockly.Events.CREATE) {
        this.growCompanion((event as Blockly.Events.BlockCreate).blockId)
      }
      if (!fromBus) {
        this.onChangeCallback?.()
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
    return this.stateLoadFailed || !this.hasRendered
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
