import { TAB_LAYERS } from './layout/mobile-tab-bar'
import * as Blockly from 'blockly'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { HostProfile } from '../core/host/host-profile'
import {
  CONTROLS, LOCALES, FOLLOW_HOST_LOCALE, surfaceOf,
  type ControlSpec, type ControlState, type ControlInvoke, type ControlOption,
} from '../core/host/controls'
import type { CodeParser } from '../core/sync-controller'
import { SyncController } from '../core/sync-controller'
import type { SyncError } from '../core/sync-controller'
import { SemanticBus } from '../core/semantic-bus'
import { showToast } from './toolbar/toast'
import { showStyleActionBar } from './toolbar/style-action-bar'
import { runDiagnostics, diagnosticsFromTree } from '../core/diagnostics'
import type { SemanticNode } from '../core/types'
import { createNode } from '../core/semantic-tree'
import type { DiagnosticBlock } from '../core/diagnostics'
import type { ProgramScaffold } from '../core/program-scaffold'
import { setDependencyResolver, setProgramScaffold, setScaffoldConfig, setHeaderAliases } from '../core/projection/code-generator'
// 🔴 **spec 153：五樣語言相關的東西在這裡接上。**
//    它們原本散在 `blockly-panel`／`block-registrar`／`sync-controller` 裡
//    ——而那三個檔是**視圖與 UI**，不該認得語言套件（P9 第一項）。
//    ⚠️ 組裝點認得語言是**設計如此**（護欄明寫「可見，不入棘輪」）。
import { TopicRegistry } from '../core/topic-registry'
import { TargetRegistry } from '../core/target-registry'
import { filterByTarget } from '../core/component/traits'
import { getVisibleComponents, flattenLevelTree } from '../core/level-tree'
import { componentTraits } from '../core/component/traits'
import type { Target, Topic } from '../core/types'
// spec 142：三塊板子。⚠️ 它們**共用** `arduino` 課程清單，差別只在 `provides`
//（不新增三份幾乎相同的 topic JSON——見 specs/142 的 research.md R1）。
import { Lifter } from '../core/lift/lifter'
import { PatternLifter } from '../core/lift/pattern-lifter'
import { PatternRenderer } from '../core/projection/pattern-renderer'
import { setPatternRenderer } from '../core/projection/block-renderer'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../core/registry'
import { allLanguagePacks, languagePack, defaultTarget } from '../core/language-packs'
import { setDegradationLanguage } from '../core/degradation-blocks'
import { setCommentLanguage } from '../core/comment-syntax'
import { loadAllLanguagePacks } from '../core/load-language-packs'
import type { LiftPattern } from '../core/types'
import { BlockSpecRegistry } from '../core/block-spec-registry'

import type { SavedState } from '../core/storage'
import { describeRefusal } from '../core/refusal-message'
import { LocaleLoader } from '../i18n/loader'
import { setMessageSource, msg } from '../core/messages'
import { LAYOUT_PRESETS, layoutPreset, type LayoutPresetId } from '../core/host/layout-presets'
import { SyncCoordinator } from '../core/sync-coordinator'
import { viewsWith } from '../core/view-registry'
import { installDialogs } from './prompt-dialog'
import type { StylePreset } from '../core/types'
import { CATEGORY_COLORS } from '../core/category-colors'
import { registerViewsIn, connectViews } from '../core/view-registry'
import { buildToolbox } from '../core/toolbox-builder'
import { lessonIdFromQuery, controlsPinnedBy, trackOf, scaffoldDepthOf, type Lesson, type ScaffoldMode } from '../core/lesson'
import { skeletonById, skeletonsOfLanguage, canHideScaffold } from '../core/skeleton'
// 🔴 「哪幾顆是骨架」的判定**住在 core**——流程視圖也問同一支（`history/188`）
import { scaffoldNodeIds as coreScaffoldNodeIds, scaffoldComponentIds as coreScaffoldComponentIds } from '../core/scaffold-nodes'
import { lessonById, allTracks, lessonsOfTrack } from '../core/load-lessons'
import { allTemplates, templateById } from '../core/load-templates'
import { registeredViews } from '../core/view-registry'
import { BlockRegistrar } from './block-registrar'
import { createAppLayout, setupToolbarButtons, setupFileButtons, updateStatusBar } from './app-shell'
import type { AppShellElements, AppShellCallbacks } from './app-shell'
import { renderStatusControls, openSettings } from './layout/status-bar-controls'
import type { ConsolePanel } from './panels/console-panel'
import { showQuickPick } from './toolbar/quick-pick'
import { BlockStyleSelector } from './toolbar/block-style-selector'
import {} from '../core/component/traits'
import { ExecutionController } from './execution-controller'
// Semantic layer
// Projection layer
import { CURRENT_VERSION, hashCode } from '../core/storage-version'

/**
 * 全部語言的風格預設——**從語言套件收，不逐個 import**。
 *
 * ⚠️ 順序＝各套件宣告的順序 ＋ 套件之間的登錄順序，
 * 而 `loadAllLanguagePacks()` 對 glob 的鍵排序，所以它在每一台機器上都一樣。
 */
loadAllLanguagePacks()
const STYLE_PRESETS: StylePreset[] = allLanguagePacks().flatMap((p) => p.styles)

const DEFAULT_STYLE: StylePreset = STYLE_PRESETS[0]

/**
 * 這顆元件是**系統自己產的鷹架**嗎（`#include`／`using namespace`／main 的 `return`）。
 *
 * 🔴 **問性狀不問身分**——`scaffold` 與 `scaffoldInMain` 是元件在
 * `component.json` 裡自己宣告的，所以換一個語言這裡一個字都不用改。
 */
function isScaffoldComponent(componentId: string): boolean {
  return componentTraits(componentId)?.scaffold === true
}

// 🪦 `addSubtree` 已搬進 `core/scaffold-nodes.ts`（2026-08-30）——流程視圖也要問同一件事。


// 🪦 `isScaffoldInMainComponent` 已搬進 `core/scaffold-nodes.ts`（2026-08-30）——流程視圖也要問同一件事。


/**
 * 一個主題的**全部**層級節點。
 *
 * 🔴 它有兩個呼叫端（開機的預設、選課之後），而**它們必須是同一份**
 * ——各寫一次的話，其中一個哪天改了，症狀是「選課前後工具箱不一樣大」
 * 而沒有人看得出來為什麼。
 */
function allBranchesOf(topic: Topic): Set<string> {
  return new Set(flattenLevelTree(topic.levelTree).map((n) => n.id))
}

export class App {
  private bus: SemanticBus
  private blocklyPanel: BlocklyPanel | null = null
  private codeView: CodeView | null = null
  private syncController: SyncController | null = null
  private blockSpecRegistry: BlockSpecRegistry
  private blockRegistrar: BlockRegistrar
  private localeLoader: LocaleLoader
  /**
   * 🔴 這個宿主有什麼、沒有什麼——**一份看得完的宣告**。
   *
   * ⚠️ **不要問「現在是哪一個宿主」**，問 `features` 或 `codeView` 的可選方法。
   * 一旦有人寫 `this.profile.id === '…'`，這份宣告就退化成一個標籤
   * ——而真相就散回各處的 `if` 裡了。
   */
  private readonly profile: HostProfile
  private storageService: ReturnType<HostProfile['createStorage']>
  private topicRegistry: TopicRegistry
  private targetRegistry: TargetRegistry
  /**
   * 🔴 **一個實例，兩個持有者**（`code-generator` 的模組層 ＋ `syncController`）。
   * 換目標時要改的是「它的外殼設定」，不是換掉物件——否則會有一個沒被換到。
   */
  // ⚠️ **型別也不再指名一個語言**（2026-08-26）——組裝點知道「有一層外殼」，
  //    不知道它是誰的。`ProgramScaffold` 是核心的介面，`setSkeleton` 是
  //    「這個外殼要不要一個進入點」——兩者都與語言無關。
  private scaffold: (ProgramScaffold & { setSkeleton?(skeleton: string): void }) | null = null
  private currentTarget: Target
  private executionController: ExecutionController | null = null
  private currentTree: SemanticNode | null = null
  /**
   * 同步的三態。🔴 **來源清單是導出的**——`viewsWith('editable')` 的第一個消費者
   * （在此之前那個宣告有三個宣告者而零個讀取點）。
   */
  private syncCoordinator = new SyncCoordinator(() => viewsWith('editable').map((v) => v.viewId))
  private blocksDirty = false
  /**
   * **現在用的桌機版面**（2026-08-26）。
   * ⚠️ 預設是「對照」——那是這個工具本來的樣子（程式碼 ＋ 積木並排），
   * 而換預設不該讓既有使用者的第一眼變成別的。
   */
  private currentLayout: LayoutPresetId = 'compare'
  private applyLayout?: (id: LayoutPresetId) => void
  private flowPanel?: import('./panels/flow-panel').FlowPanel
  private codeDirty = false
  private autoSync = true
  private codeToBlocksTimer: ReturnType<typeof setTimeout> | null = null
  private currentTopic: Topic
  private enabledBranches: Set<string>
  /**
   * 這一輪選了哪一堂課——`?lesson=` 帶進來的。
   *
   * 🔴 `undefined` ＝ **沒有選課**，而那時整個系統要與有這一格之前**逐字相同**。
   * ⚠️ 它是 `session` 域的（跟著這一次開啟走），**不進存檔**
   *    ——連結本身就是那個狀態（`draft/教案是一個宣告`：「換裝置也記得，零後端」）。
   */
  private currentLesson: Lesson | undefined
  /**
   * 選了哪一條**軌道**——⚠️ 它可以在**還沒選章節**時就有值嗎？
   * 不行：`selectTrack` 一定會接著選第一章。留這一格是為了
   * 「章節」那顆知道要列誰，而不必從 `currentLesson` 反推。
   */
  private currentTrack: string | undefined
  /**
   * 鷹架露到第幾層——**它自己的一格**（2026-08-28 從 `enabledBranches` 拆出來）。
   *
   * 🔴 拆之前那個集合同時扛著「哪些元件看得到」與「鷹架露到第幾層」，
   * 於是「預設全開」（**只想改前者**）連帶把鷹架從剝掉變成可編輯，
   * 而症狀是**斷點停得住而變數面板是空的**。
   *
   * > **兩個決定共用一個載體時，改動其中一個永遠會偷偷改到另一個。**
   */
  private scaffoldDepth = 0
  /**
   * 目前用哪一份**骨架**宣告。
   *
   * 🔴 它在 2026-08-28 之前只活在 `CppScaffold` 裡面（`setSkeleton`），
   * 而**沒有人問得到現在是哪一份**——於是狀態列上顯示不出來。
   */
  private currentSkeletonId = 'main'
  private currentIoPreference: 'iostream' | 'cstdio' = 'iostream'
  private _codeToBlocksInProgress = false
  private _restoringState = false
  private currentStylePreset: StylePreset = DEFAULT_STYLE
  private currentBlockStyleId: string = 'scratch'
  private currentLocale: string = 'zh-TW'

  /**
   * 使用者**選的**語系——⚠️ 它可能是 `follow-host`，而那時 `currentLocale`
   * 是解析後的結果。
   *
   * 🔴 兩者必須分開存：只留 `currentLocale` 的話，
   * 「跟隨宿主」在下一次開機就退化成一個固定值，而使用者不會發現。
   */
  private localePreference: string = 'zh-TW'

  /** 宿主的顯示語言（`vscode.env.language`）。`null` ＝ 這個宿主沒說。 */
  private hostLocale: string | null = null

  /** 最近一次算出來的控制項狀態——行動版的設定清單開啟時讀它。 */
  private latestControlStates: ControlState[] = []

  /**
   * 行動版的設定 —— **一張往下鑽的 QuickPick**（2026-08-25）。
   *
   * 使用者：「目前行動版的選單，我覺得使用者體驗不好」——舊的是
   * 從工具列往下掉的漢堡選單，而點一列又跳出底部的 QuickPick：
   *
   * > **一次操作裡換兩種介面，使用者要重新找一次「按哪裡」。**
   */
  private openSettingsMenu(): void {
    openSettings(this.latestControlStates, (invoke) => this.handleControlInvoke(invoke))
  }

  /** 切換 editor 區顯示哪一個投影（積木／流程）。 */
  private showProjection: ((which: 'blocks' | 'flow') => void) | null = null

  /** 把主控台那一格加回下方面板——宿主打不開終端機時。 */
  private enableConsoleTab: (() => void) | null = null

  /** 控制項的回呼——面板的下拉與宿主的 QuickPick **共用這一組**。 */
  private controlCallbacks: Pick<AppShellCallbacks,
    'onTargetChange' | 'onBranchesChange' | 'onStyleChange' | 'onBlockStyleChange' | 'onLocaleChange'> | null = null
  /**
   * 目前語言的解析器。
   *
   * ⚠️ **原本叫 `cppParser`**——那個名字本身就是「組裝點知道語言的名字」。
   * 而它的用途（重新解析程式碼以重建語義樹）**與語言無關**。
   */
  private patternRenderer: PatternRenderer | null = null

  constructor(profile: HostProfile) {
    this.profile = profile
    this.bus = new SemanticBus()
    this.blockSpecRegistry = new BlockSpecRegistry()
    // 🪦 **`setLanguageInputNames(...)` 已於 2026-08-26 刪除**——那份契約
    //    從十二個插槽名一路縮到一個，而最後一個的消費者
    //    （`cpp_var_declare_expression` 的命令式定義）今天退場了。
    //    組裝點不再需要告訴視圖層任何一個 C++ 的插槽名。
    this.blockRegistrar = new BlockRegistrar(this.blockSpecRegistry)
    // 🔴 **與執行那側同一份來源**（`currentBoard: () => this.currentTarget.board`）
    //    ——兩邊如果各查各的，遲早會有一邊落後。
    this.blockRegistrar.setBoardProvider(() => this.currentTarget.board)
    this.localeLoader = new LocaleLoader()
    // 🔴 **把翻譯表接到核心的訊息埠上**（2026-08-24）。
    //
    // 語言套件原本自己 `import * as Blockly` 只為了讀 `Blockly.Msg`，
    // 於是「載入一個語言」＝「載入整個 Blockly ＋ jsdom」——那在 Node 宿主
    // 直接爆掉（`examples/bring-your-own-view/` 量到的）。
    //
    // ⚠️ 沒接的宿主拿到的是 fallback，而**那不是降級，是預設行為**：
    // 一個沒有 UI 的宿主本來就沒有翻譯表。
    setMessageSource((key) => (Blockly.Msg as Record<string, string>)[key])
    // 🔴 **問人這件事要走頁面，不走瀏覽器的原生對話框**——
    //    `window.prompt` 在 VSCode 的 webview 裡是停用的（見 `prompt-dialog.ts`）。
    installDialogs()
    this.storageService = this.profile.createStorage()
    this.topicRegistry = new TopicRegistry()
    this.targetRegistry = new TargetRegistry()

    // 🔴 **組裝點知道自己裝了「一些語言」，不知道它們各自叫什麼**（P3／P9）。
    //
    // 在 spec 161 之前這裡有 5 + 14 行逐個 `register(...)`，而加第三個語言
    // 就是再加一輪——**而中立性護欄豁免組裝點、不印數字，所以沒有人會看見。**
    //
    // ⚠️ **順序仍然是設計出來的**，只是那個設計搬進了各語言的 `pack.ts`
    // （由簡到繁的板子順序在 `cpp/pack.ts` 的陣列裡）。這裡只保證
    // **套件之間**的順序穩定（`loadAllLanguagePacks` 對 glob 的鍵排序）。
    for (const pack of allLanguagePacks()) {
      for (const t of pack.topics) this.topicRegistry.register(t)
      for (const t of pack.targets) this.targetRegistry.register(t)
    }

    // Default target → topic and branches (only root level enabled for simplest starting point)
    // 🔴 **問宣告**（哪個 topic 標了 `default: true`），不是取陣列第一個。
    // ⚠️ 第一版寫 `allLanguagePacks()[0].targets[0]`，而 glob 的順序讓預設變成 Python
    // ——**全套測試綠，瀏覽器一開就看得見**。
    this.currentTarget = defaultTarget()!
    this.currentTopic = this.topicRegistry.get(this.currentTarget.topic)!
    // 🔴 **預設全開**（2026-08-28 使用者拍板：「我想說要預設全開」）。
    //
    // 在此之前預設是**只有根節點**（`層級 1/10`），而那讓一個剛打開工具的人
    // 看到一個殘缺的工具箱，且**沒有任何線索說少了什麼**。
    //
    // > 使用者 2026-08-12 的原話已經否證過那個設計：
    // > 「我會乾脆叫學生把全部都打勾，**那有沒有這個漸進揭露是沒用的**」
    //
    // 🎯 收窄由**課**來做（`?lesson=`），不由一個沒有人答得出來的打勾清單做。
    this.enabledBranches = allBranchesOf(this.currentTopic)

    // 🔴 **一堂課替使用者做決定**——`?lesson=<軌道>/<課>`。
    //
    // `principles.md:97`（P4①）逐字：「一個過濾機制若沒有附帶『條件從哪來』，
    // 它把認知負荷搬家而不是減少。**而那個來源今天缺的是教材**」。
    // 2026-08-28 那個來源存在了，這裡是它的入口。
    //
    // ⚠️ **沒有 `?lesson` 時一格都不動**——這是回歸閘。
    const lessonId = lessonIdFromQuery(this.profile.querySearch ?? '')
    if (lessonId !== null) {
      const lesson = lessonById(lessonId)
      // 🔴 **找不到要出聲**。靜靜地當成「沒有課」的話，老師貼出去的連結
      //    會安靜地退回預設組態，而**畫面上看起來一切正常**。
      if (!lesson) console.error(`[lessons] 找不到 ${lessonId}——連結指向一堂不存在的課`)
      else this.applyLesson(lesson)
    }
  }

  /**
   * 換一份骨架，或換鷹架的顯示模式——**重畫投影，不動語義樹**。
   *
   * ## 🔴 這裡曾經呼叫 `syncBlocksToCodeWithMappings()`，而那是一個嚴重的錯
   *
   * 那支從**積木**產生程式碼，而積木畫的是**剝過鷹架的顯示樹**。
   * 於是切一次顯示模式，`currentTree` 就從
   *
   * ```
   * include · using_namespace · func_def     →     print
   * ```
   *
   * ——**一個「顯示設定」把唯一真實給改掉了**，而方向還是反的
   * （切成「完整」反而變少）。
   *
   * > **改投影的動作不得寫回真相。**
   * > 而它的症狀是無聲的：程式碼那一側看起來還好，因為產生器
   * > 會把鷹架補回去——**下一次同步才會發現東西不見了**。
   *
   * 🟢 正解是**從語義樹重新投影一次**（`refreshViews`），
   * 那是 `useAsSource('積木')` 以外唯一該碰積木的方向。
   */
  /**
   * **剝不掉的骨架不得停在「隱藏」。**
   *
   * 🔴 Arduino 有兩個進入點（`setup`／`loop`），兩批語句攤平之後分不回去
   * ——所以 `hidden` 在選單上不端出來（`publishControls`）。而**選單不端出來
   * 不等於狀態不會是它**：從 C++（`hidden`）切到 Arduino 就會停在那裡，
   * 而那時畫面顯示「隱藏」卻什麼都沒藏。
   *
   * > **一個從選單上拿掉的選項，如果狀態還到得了它，那就只是看不到而已。**
   */
  private enforceShellDepthFloor(): void {
    if (!canHideScaffold(skeletonById(this.currentSkeletonId)) && this.scaffoldDepth === 0) {
      this.scaffoldDepth = 1
      setScaffoldConfig({ scaffoldDepth: this.scaffoldDepth })
      this.syncController?.setScaffoldDepth(this.scaffoldDepth)
    }
  }

  /**
   * **換一份骨架**——三個持有者一起換。
   *
   * 🔴 它從哪來（2026-08-28）：`applyLesson` **直接換了 `currentTarget`**
   * 而沒有動骨架，於是用 `?lesson=arduino/01-閃一顆燈` 開課時
   * `currentSkeletonId` 還停在 `'main'`——**Arduino 的 `setup`／`loop`
   * 一顆都不算骨架**（`entryFunctionOf(main 的宣告, 'setup')` 是 undefined）。
   *
   * ⚠️ 而症狀不會報錯：畫面上就是「切成淡的而什麼都沒變」。
   * 抓到它的是 `lessons.spec.ts` 那條**入口條件**
   * （「一顆骨架元件都認不出來 → 下面那條斷言是空過的」）。
   *
   * > **同一個決定有兩個入口時，第二個入口不會報錯——它只是安靜地少做一件事。**
   */
  private adoptSkeleton(id: string): void {
    this.currentSkeletonId = id
    this.scaffold?.setSkeleton?.(id)
    this.syncController?.setSkeleton?.(id)
  }

  private setSkeleton(id: string): void {
    if (!skeletonById(id)) { console.error(`[skeleton] 選了一份不存在的骨架：${id}`); return }
    // 🔴 **三個持有者一起換**（鷹架、補丁器、同步器）——見 `adoptSkeleton`
    this.adoptSkeleton(id)
    this.enforceShellDepthFloor()
    this.updateToolbox()
    this.reprojectFromTree()
    this.publishControls()
  }

  /**
   * 換鷹架的顯示模式。
   *
   * ⚠️ 它會**覆寫課程的設定**，而那是對的：課程說的是「這堂課建議這樣看」，
   * 而使用者當下說的是「我現在想這樣看」。
   */
  private setScaffoldMode(mode: ScaffoldMode): void {
    this.scaffoldDepth = scaffoldDepthOf(mode)
    setScaffoldConfig({ scaffoldDepth: this.scaffoldDepth })
    this.syncController?.setScaffoldDepth(this.scaffoldDepth)
    this.updateToolbox()
    this.reprojectFromTree()
    // ⚠️ `reprojectFromTree` 是非同步的——重畫完才輪得到蓋視覺這一層。
    //    🔴 少了這一句，切模式之後**要等下一次編輯**才看得到效果。
    setTimeout(() => this.markOutOfScopeBlocks(), 900)
    this.publishControls()
  }

  /**
   * **從語義樹重新投影一次**——不動樹本身。
   *
   * 🔴 走的是「以此為準：程式碼」那條既有的路：先從樹產生程式碼，
   * 再讓它重新 lift 回來。⚠️ 而**不是**從積木反推
   * ——積木畫的是剝過鷹架的顯示樹，拿它當來源會把鷹架吃掉。
   */
  private reprojectFromTree(): void {
    const code = this.codeView?.getCode?.() ?? ''
    if (code.trim() === '') return
    void this.syncController?.syncCodeToBlocks(code)
  }

  /**
   * 套用一份範例——**把它的程式碼放進編輯器**。
   *
   * ⚠️ **會蓋掉畫布上的東西**，所以先問一句。
   * 🔴 「選了範例卻沒看到範例」比「被問一句」更糟，而**吃掉使用者的作品**
   *    比兩者都糟——所以是「問」，不是「靜靜地套」也不是「靜靜地不套」。
   */
  private applyTemplate(id: string): void {
    const t = templateById(id)
    if (!t) { console.error(`[templates] 選了一份不存在的範例：${id}`); return }
    // 🔴 **問語義樹，不問面板**——「有沒有東西」是那份唯一真實的性質，
    //    而不是某一個投影的性質（根公理）。⚠️ 也不用戳面板的私有欄位。
    const body = this.syncController?.getCurrentTree()?.children?.body ?? []
    const hasWork = body.length > 0
    const go = (): void => {
      // 換目標（範例釘住它），再把程式碼放進去
      const target = this.targetRegistry.all().find((x) => x.id === t.target)
      if (target && target.id !== this.currentTarget.id) {
        this.currentLesson = undefined
        this.currentTrack = undefined
        this.handleTargetChange(target, this.topicRegistry.get(target.topic)!, allBranchesOf(this.topicRegistry.get(target.topic)!))
      }
      this.codeView?.setCode(t.code)
      void this.syncController?.syncCodeToBlocks(t.code)
      this.publishControls()
    }
    if (!hasWork) { go(); return }
    showQuickPick(
      {
        title: `套用範例「${t.name}」？畫布上現在的東西會被蓋掉`,
        items: [
          { value: 'yes', label: '套用（現在的內容會不見）' },
          { value: 'no', label: '取消' },
        ],
      },
      (v) => { if (v?.[0] === 'yes') go() },
    )
  }

  /**
   * 使用者選了一條**軌道**（或「不選課程」）。
   *
   * 🔴 **選軌道等於選它的第一章**——一個選了課程而沒有章節的狀態，
   * 畫面上與「還沒選」分不出來，而學生會卡在那裡。
   */
  private selectTrack(id: string): void {
    if (id === '') { this.currentTrack = undefined; this.selectLesson(''); return }
    this.currentTrack = id
    const first = lessonsOfTrack(id)[0]
    if (!first) {
      console.error(`[lessons] 軌道 ${id} 一章都沒有`)
      return
    }
    this.selectLesson(first.id)
  }

  /**
   * 使用者**在畫面上**選了一堂課（或選了「不選課程」）。
   *
   * 🔴 **走 `handleTargetChange` 那條既有的整套重繪**，不自己再拼一次
   * ——切目標要做的十件事（鷹架深度／風格／標頭別名／文法／語言／工具箱…）
   * 在那裡已經是對的，而抄第二份的話它們遲早會不同意。
   */
  private selectLesson(id: string): void {
    const lesson = id === '' ? undefined : lessonById(id)
    if (id !== '' && !lesson) {
      console.error(`[lessons] 選了一堂不存在的課：${id}`)
      return
    }
    this.currentLesson = lesson
    this.currentTrack = lesson ? trackOf(lesson.id) : this.currentTrack
    // 課釘的目標可能與現在不同——讓 `handleTargetChange` 去處理那一整套。
    const wantId = lesson?.pins.target ?? this.currentTarget.id
    const target = this.targetRegistry.all().find((t) => t.id === wantId) ?? this.currentTarget
    const topic = this.topicRegistry.get(target.topic)!
    this.handleTargetChange(target, topic, allBranchesOf(topic))
    // ⚠️ `handleTargetChange` 會依層級重算深度——**課的設定要蓋過它**。
    //    （順序不能反：那個函式在後面的話，課說的話會被層級蓋掉。）
    if (lesson) {
      this.scaffoldDepth = scaffoldDepthOf(
        lesson.pins.scaffold ?? allTracks().get(trackOf(lesson.id))?.scaffold ?? 'editable',
      )
      setScaffoldConfig({ scaffoldDepth: this.scaffoldDepth })
      this.syncController?.setScaffoldDepth(this.scaffoldDepth)
      this.updateToolbox()
    }
    // ⚠️ `handleTargetChange` 重繪工具箱，而**控制項清單要另外重送**
    //    ——被釘住的那顆要消失／回來，而那不是目標改變的一部分。
    this.publishControls()
  }

  /**
   * 套用一堂課：釘住目標、收窄可見元件。
   *
   * ⚠️ 被釘住的控制項**消失**（`publishControls` 濾掉它），不是變灰
   * ——「這裡有一個你不能碰的東西」仍然是負擔，而且它在嘲笑你。
   */
  private applyLesson(lesson: Lesson): void {
    this.currentLesson = lesson
    const t = lesson.pins.target
    if (t !== undefined) {
      const target = this.targetRegistry.all().find((x) => x.id === t)
      if (!target) {
        console.error(`[lessons] ${lesson.id} 釘住一個不存在的目標：${t}`)
      } else {
        this.currentTarget = target
        this.currentTopic = this.topicRegistry.get(target.topic)!
        // 🔴 **骨架要跟著目標換**（2026-08-28）——在此之前這裡漏了它，
        //    於是 `?lesson=arduino/…` 開的課停在 C++ 的骨架上。見 `adoptSkeleton`。
        this.adoptSkeleton(target.skeleton ?? 'main')
      }
    }
    // 🔴 **層級全開**——收窄由課的 `components` 做，不由層級做。
    //    留一半層級一半課的話，同一件事有兩個開關，而它們會不同意。
    this.enabledBranches = allBranchesOf(this.currentTopic)
    // 🔴 **鷹架露多少由【課程組態】決定**（2026-08-28 使用者拍板：
    //    「在課程的組態就可以設定要使用哪一種鷹架」）。
    //    ⚠️ 課可以覆寫軌道；兩個都沒說就 `editable`。
    //    而「鷹架**長什麼樣**」是另一格，住在**目標**上（`skeleton`）。
    const track = allTracks().get(trackOf(lesson.id))
    this.scaffoldDepth = scaffoldDepthOf(lesson.pins.scaffold ?? track?.scaffold ?? 'editable')
    // 🔴 **課程也可以換一份【骨架】**（不只是露多少）——省略就跟著目標走。
    if (track?.skeleton !== undefined) this.adoptSkeleton(track.skeleton)
    // 🔴 剝不掉的骨架（Arduino）不得停在「隱藏」——見 `enforceShellDepthFloor`
    this.enforceShellDepthFloor()
  }

  async init(): Promise<void> {
    // 1. Register C++ generators + dependency resolver + scaffold
    // 🔴 **把【每一個】語言接上，而不是只接 C++**（spec 171）。
    //
    // ⚠️ 在此之前這一行是 `registerCppLanguage()`，於是第二個語言的
    // 產生器從來沒有被註冊過。症狀：切到 Python、走【積木→程式碼】
    // 那個方向 → `⟨unknown component: python:program⟩`。
    //
    // > **組裝點知道「要把每個語言接上」是正常的，知道它們各自怎麼接不是。**
    for (const lp of allLanguagePacks()) lp.install?.()
    // 🟢 **2026-08-26：使用者的碼【外面】那一層，改由語言套件裝配好交出來。**
    //    在此之前這裡寫死 `createPopulatedRegistry()` ／ `new CppScaffold(...)`，
    //    而那份登記表要傳給四個消費者——**那正是 vision 說的「深度交織」**。
    //    ⚠️ 交織的不是程式碼，是**那份共用的登記表沒有主人**。
    const shaping = languagePack(this.currentTopic.language)?.createCodeShaping?.() ?? null
    if (shaping) {
      setDependencyResolver(shaping.moduleRegistry as never)
      this.scaffold = shaping.scaffold as never
      setProgramScaffold(this.scaffold!)
    }
    setScaffoldConfig({ scaffoldDepth: this.getScaffoldDepth() })
    // 🔴 **標頭替換跟著目標走**（spec 150）——`<WiFi.h>` 在 ESP8266 上叫別的名字。
    setHeaderAliases(this.currentTarget.headerAliases)
    this.localeLoader.setBlocklyMsg(Blockly.Msg as Record<string, string>)
    await this.localeLoader.load('zh-TW')

    // 2. Load block specs (split component/projection architecture)
    // 🟢 **2026-08-26：從寫死的 `allCppComponents()` 換成問登記表。**
    //    ⚠️ 在此之前第二個語言的宣告靠的是「那個 glob 剛好也掃到它」，
    //    而不是它自己說了——**一個靠副作用成立的涵蓋，加第三個語言時會安靜地漏掉**。
    const allComponents: unknown[] = []
    const allProjections: unknown[] = []
    for (const lp of allLanguagePacks()) {
      const d = lp.declarations?.()
      if (d) { allComponents.push(...d.components); allProjections.push(...d.projections) }
    }
    this.blockSpecRegistry.loadFromSplit(allComponents as never, allProjections as never)

    // 4. Register all blocks with Blockly
    this.blockRegistrar.registerAll({
      getWorkspace: () => this.blocklyPanel?.getWorkspace() ?? null,
    })

    // 5. Build UI layout
    const appEl = document.getElementById('app')
    if (!appEl) throw new Error('#app element not found')

    const elements: AppShellElements = createAppLayout(appEl, this.blockSpecRegistry, this.callBuildToolbox(), this.profile,
      {
        // 🔴 **問【目前語言】的宣告，不寫死一個建構子**（spec 171）。
        //
        // ⚠️ 第一版寫死 import 了 C++ 的 `buildProgram`，而它在應用建構時
        // 注入一次、**切語言時不會變**。症狀：切到 Python 之後程式碼面板顯示
        // `⟨unknown component: cpp:program⟩`——積木是 Python 的、執行結果是對的，
        // 而樹的根是 C++ 的。
        //
        // > **一個在啟動時決定的「哪一顆是根」，
        // > 遇到「隨時可以切語言」的選單就會過期。**
        //
        // ⚠️ 而它**只在【積木→程式碼】那個方向出現**（另一個方向的根是 lift 出來的）
        // ——所以使用者看到的是「有時候」。
        // > **一個只在單一方向上壞掉的缺陷，在另一個方向上看起來完全正常。**
        buildProgramRoot: ((body: SemanticNode[] = []) => {
          const pack = languagePack(this.currentTopic.language)
          if (!pack) throw new Error(`沒有語言套件：${this.currentTopic.language}——建不出程式根`)
          return createNode(pack.programRoot, {}, { body })
        }) as never,
        // 🔴 **用建構選項而不是事後呼叫**（spec 153）：
        //    ① 不新增一筆「直接呼叫視圖」（第四項獨立性的棘輪）
        //    ② 時機回到面板建構時——**沒有「裝了沒人接上」的窗口**
        // 🟢 **2026-08-26：從寫死的 `registerCppExtractStrategies` 換成問登記表**
        //    ——組裝點知道「每個語言都可能有抽取策略」，不知道 C++ 的那支叫什麼。
        installExtractStrategies: ((extractor: unknown) => {
          for (const lp of allLanguagePacks()) lp.installExtractStrategies?.(extractor)
        }) as never,
      })
    this.blocklyPanel = elements.blocklyPanel
    this.showProjection = elements.showProjection
    this.enableConsoleTab = elements.enableConsoleTab
    elements.onBottomPanelReady((panel) => this.executionController?.attachBottomPanel(panel))
    this.codeView = elements.codeView

    // 6. Create sync controller + wire scaffold + connect panels to bus
    this.syncController = new SyncController(this.bus, this.currentTopic.language, DEFAULT_STYLE)
    this.syncController.setStyleAnalyzer({
      // ⚠️ 用吃 `StylePreset` 的那個門面——收窄發生在語言那側，不是這裡也不是引擎裡
      // 🟢 **2026-08-26：三支風格例外改由語言套件宣告**（`styleExceptions`）。
      // 🔴 **這條 `?.` 鏈交得出 `undefined`——Python 套件沒有 `styleExceptions`。**
      //    介面已經宣告成 `| undefined`（2026-08-27），所以這裡不再需要 `as never`
      //    ⚠️ 而 `as never` **還留著**：`languagePack` 那側的簽章是 `never[]`／
      //    `unknown`，拿掉它要連著改語言套件的型別，那是另一次重構。
      //    🟢 真正的修法在**介面**（`SyncController` 的 `StyleAnalyzer` 宣告成
      //    `| undefined`）與**消費端**（`sync-controller.ts` 三處明確處理）。
      //    在此之前介面宣告「一定回傳」，而代價是
      //    **Python 的程式碼→積木整條崩掉，症狀長得像「這段程式沒有積木」**。
      detectStyleExceptions: ((...a: never[]) =>
        languagePack(this.currentTopic.language)?.styleExceptions?.detect(...a)) as never,
      applyStyleConversions: ((...a: never[]) =>
        languagePack(this.currentTopic.language)?.styleExceptions?.convert(...a)) as never,
      // ⚠️ **收窄發生在組裝點**——`IoPreferenceKey` 是語言專屬的型別，
      //    而視圖層那一側的簽章是中立的 `string`。
      analyzeIoConformance: ((code: string, pref: string) =>
        languagePack(this.currentTopic.language)?.styleExceptions?.analyzeIo(code, pref)) as never,
    })
    // 面板的降級路徑要產生程式碼文字，用的必須是**同一組**語言與風格
    // ——面板自己不得寫死一個（FR-003）。見 specs/060-panel-parallel-generator/
    this.blocklyPanel?.setCodeContext(this.currentTopic.language, DEFAULT_STYLE)
    if (this.scaffold) this.syncController.setProgramScaffold(this.scaffold)
    if (shaping) {
      // 🔴 **把骨架宣告一起交下去**（2026-08-28）——「哪一顆函式是骨架」
      //    在此之前寫死成 `name === 'main'`，於是 Arduino 的 `setup`／`loop`
      //    永遠不算鷹架。與下面那個補丁器讀的是同一格。
      this.syncController.setScaffoldNodeFilter(((tree: unknown) =>
        (shaping.stripScaffoldNodes as (t: unknown, skeleton: string) => unknown)(
          tree, this.currentSkeletonId)) as never)
      const patch = shaping.patchCode as (
        code: string, tree: unknown, ns: string, depth: number, skeleton: string) => string
      this.syncController.setCodePatcher(((code: string, tree: unknown) => patch(
      code, tree, this.currentStylePreset.namespace_style, this.getScaffoldDepth(),
      // 🔴 **第二個「要不要 main」的入口**——鷹架是第一個。兩邊都要問同一份宣告。
      // ⚠️ 讀的是 `currentSkeletonId` **不是** `currentTarget.skeleton`（2026-08-28 修）：
      //    使用者在選單上換了骨架之後，目標那一格**不會變**
      //    ——於是補丁器繼續照舊的骨架補，而鷹架那側已經換了。
      this.currentSkeletonId,
      )) as never)
    }

    // Inject auto-include nodes into the display tree when scaffold is visible (depth > 0).
    // Auto-includes are generated transiently by computeAutoIncludes() during code generation
    // but not stored as semantic nodes. This enhancer makes them visible as blocks whenever
    // the user is at a level that shows scaffold (i.e., not L0-only mode).
    this.syncController.setDisplayTreeEnhancer((tree, _visible, scaffoldVisible) => {
      if (!scaffoldVisible || !shaping) return tree
      // 🟢 哪些引入要補、以及「引入」是哪一顆元件，都是語言套件的知識
      const includeNodes = (shaping.autoIncludeNodes as (t: never) => SemanticNode[])(tree as never)
      if (includeNodes.length === 0) return tree
      return {
        ...tree,
        children: { ...tree.children, body: [...includeNodes, ...(tree.children.body ?? [])] },
      }
    })

    this.syncController.setTopic(this.currentTopic, this.enabledBranches)

    this.syncController?.setScaffoldDepth(this.scaffoldDepth)
    // ── 視圖：登錄，而不是硬編 ────────────────────────────────
    //
    // ⚠️ 這裡原本是一段硬編的 `if (source === …) this.codeView?.setCode(…)`，
    // 而**同時**四個面板各自有一個 `connectBus()` 在訂閱同樣的事件。
    //
    // 查證結果：**`connectBus` 從來沒有人呼叫過**——那一層整個是死的，
    // 真正的線一直是這裡的硬編。
    //
    // > **兩份實作裡有一份是死的時，活的那份會慢慢長出只有它才有的條件**
    // > ——monaco 的自訂閱漏掉 `resync`，而沒有人發現，因為它沒在跑。
    //
    // ⚠️ 這裡曾經寫著「加一個視圖 = registerView(它)，**這個檔不用動**」，
    // 而它下面就是一份手寫的四元素陣列——加第五個視圖一定要改它。
    //
    // > **一個註解宣稱「這個檔不用動」，而它下一行就是要動的地方。**
    //
    // 改成掃描之後那句話才是真的：面板只要實作 `ViewHost` 就會被收。
    // 那是硬體域的 2D／3D 組裝面板、以及板子視圖要接進來的地方
    // （見 `draft/2026-08-05-硬體域併入計畫.md`「視圖：地基已經在了」）。
    const registeredHosts = registerViewsIn(elements)
    // 入口條件（`build-guardrail` 第 9 步）：**掃描器會掃 ≠ 真的掃到東西**。
    // ⚠️ 錨在「有沒有」而不是「有幾個」——後者會在加第五個視圖的那天變紅。
    if (registeredHosts.length === 0) {
      throw new Error(
        'app-shell 沒有回傳任何 ViewHost——視圖登錄表是空的，而症狀是整個畫面都不更新。',
      )
    }
    // 🔴 **分頁列呈現的每一層，都要真的有視圖在那裡**（2026-08-26）。
    //
    //    手機分頁列從 `LAYER_ORDER` 長出來，而視圖各自宣告自己在哪一層。
    //    兩邊**沒有人保證對得上**——而漏掉的症狀是**一個點了沒反應的分頁**，
    //    不是錯誤。
    //
    // > **兩份從同一個詞彙長出來的東西，不會因為詞彙相同就自動對得上。**
    //
    //    ⚠️ 只在有手機版面時檢查——沒有分頁列時沒有東西要對。
    if (this.profile.features.mobileLayout) {
      const layersWithViews = new Set(registeredHosts.map((v) => v.capabilities.layer).filter(Boolean))
      const emptyTabs = TAB_LAYERS.filter((l) => !layersWithViews.has(l))
      if (emptyTabs.length > 0) {
        throw new Error(
          `手機分頁列有這幾層，而沒有任何視圖宣告自己在那裡：${emptyTabs.join('、')}\n`
          + '  ⚠️ 症狀是**一個點了沒反應的分頁**，不是錯誤——所以這裡出聲。',
        )
      }
    }
    connectViews(this.bus)
    // 兩個面板還用匯流排做契約外的事，自己接：
    // - `console-panel` **收** `execution:output`
    // - `monaco-panel` **發** `execution:breakpoints`（把行號翻成 nodeId）
    elements.consolePanel?.connectBus(this.bus)
    this.codeView?.connectBus(this.bus)

    // 🔴 **診斷的第二個產出端在樹上，而樹只從匯流排來。**
    //
    // 語法錯誤（少一個分號）的資料標在語義節點上，而 `runDiagnostics` 吃積木
    // ——積木上看不出少了分號（tree-sitter 復原之後那顆積木是完整的）。
    //
    // ⚠️ 而這順帶補上一個既有缺口：診斷原本**只掛在 Blockly 的變更上**
    // （`wireBlocklyChangeHandler`），所以程式碼改動不會直接觸發診斷。
    // `e2e/diagnostics.spec.ts` 的檔頭記過「那是另一條線，今天沒有防線」。
    this.bus.on('semantic:update', (e) => {
      if (e.tree) this.currentTree = e.tree
      this.runAllDiagnostics()
    })

    // 8. Setup code→blocks pipeline
    await this.setupCodeToBlocksPipeline()

    // 9. Wire panel change events
    this.wireBlocklyChangeHandler()
    this.wireHostSyncCommands()
    this.codeView.onChange(() => {
      // 🔴 記住**上一步在哪裡做的**——那一對按鈕靠它轉送（見 `lastEditor`）
      this.lastEditor = 'code'
      if (this._codeToBlocksInProgress) return
      this.codeDirty = true
      // 🔴 記下「誰被編輯」——來源是導出的，而暫停期間這筆會累積成分岔
      // ⚠️ `CodeView` 是宿主注入的介面，不保證是 `ViewHost`——用登錄表裡那個
      //    可編輯而**不是積木**的視圖當來源（網頁版是 monaco，擴充是 vscode-code-view）
      this.syncCoordinator.noteEdit(this.codeViewId())
      this.updateSyncHints()
      if (this.autoSync) this.scheduleCodeToBlocksSync()
    })

    // 10. Setup execution controller
    this.executionController = new ExecutionController(
      {
        blocklyPanel: this.blocklyPanel,
        codeView: this.codeView,
        consolePanel: elements.consolePanel,
        variablePanel: elements.variablePanel,
        bottomPanel: elements.bottomPanel,
        syncController: this.syncController,
      },
      {
        // 🔴 **每次執行都問一次**——目標會在執行之間被切換（spec 145）。
        currentBoard: () => this.currentTarget.board as never,
        bus: this.bus,
        getBlocksDirty: () => this.blocksDirty,
        syncBeforeRun: () => {
          this.syncBlocksToCodeWithMappings()
        },
      },
    )
    this.executionController.setupExecution()

    // 11. Setup toolbar + selectors
    setupToolbarButtons({
      onOpenSyncMenu: () => this.openSyncMenu(),
      // 🔴 **與宿主那側走同一支**（`handleControlInvoke`）——一個入口，不是兩個。
      onAction: (id) => this.handleControlInvoke({ id }),
      onOpenSettings: () => this.openSettingsMenu(),
    })

    // 🔴 這個宿主沒有檔案按鈕就【不接線】——DOM 根本不存在。
    if (this.profile.features.fileButtons) setupFileButtons(this.storageService, {
      getExportState: () => this.buildSaveState(),
      importState: (state: SavedState) => {
        // ⚠️ 匯入那條路走**同一個**失效判定——兩條路徑鬆緊度不同是這個模組的老病
        //    （`storage-version.ts` 檔頭記著：自動載入那條什麼都不檢查）
        if (this.sideCarUsable(state)) this.blocklyPanel?.setState(state.blocklyState)
        if (state.code) this.codeView?.setCode(state.code)
      },
      onUploadCustomBlocks: (blocks: object[]) => {
        for (const blockDef of blocks) Blockly.common.defineBlocksWithJsonArray([blockDef])
        this.updateToolbox()
        showToast(Blockly.Msg['TOAST_UPLOAD_SUCCESS'] || `Uploaded ${blocks.length} custom blocks`, 'success')
      },
    })

    // 🔴 **抽成一個物件**：同一組回呼有兩個入口——面板上的下拉，
    //    以及**宿主那側的 QuickPick／標題列**。
    //
    // > **同一件事有兩個入口時，要嘛共用一個實作，
    // > 要嘛就會有兩個「切換之後畫面長什麼樣」的真相。**
    //
    // ⚠️ 那句話本來就寫在 `handleTargetChange` 的註解上——這裡是它的第二次應用。
    this.controlCallbacks = {
      // 🔴 **選一次而不是三次**：一個目標同時決定課程清單與風格。
      // ⚠️ 而它**不新寫第三條路**——底下走的仍然是既有的兩條
      //（課程清單那條在這裡、風格那條是 `applyStyle`），
      // 新寫一條會讓「切換之後畫面長什麼樣」有兩個真相來源。
      onTargetChange: (target, topic, branches) => this.handleTargetChange(target, topic, branches),
      onBranchesChange: (branches) => {
        const prevDepth = this.getScaffoldDepth()
        this.enabledBranches = branches
        // 🔴 剝不掉的骨架（Arduino）不得停在「隱藏」——見 `enforceShellDepthFloor`
        this.enforceShellDepthFloor()
        const newDepth = this.getScaffoldDepth()
        setScaffoldConfig({ scaffoldDepth: newDepth })
        this.syncController?.setBranches(branches)
        this.updateToolbox()
        this.markOutOfScopeBlocks()
        if (!this._restoringState) {
          if ((prevDepth === 0) !== (newDepth === 0)) {
            this.resyncAfterTopicChange()
          } else {
            this.syncBlocksToCodeWithMappings()
          }
        }
        this.refreshStatusBar()
      },
      onStyleChange: (style) => {
        this.syncController?.setStyle(style)
        this.blocklyPanel?.setCodeContext(this.currentTopic.language, style)  // 面板不得落後於同步控制器
        this.syncController?.setCodingStyle(style)
        this.syncBlocksToCodeWithMappings()
        this.currentStylePreset = style
        this.refreshStatusBar()
        const ioPref = style.io_style === 'printf' ? 'cstdio' : 'iostream'
        if (ioPref !== this.currentIoPreference) {
          this.currentIoPreference = ioPref
          this.updateToolbox()
        }
      },
      onBlockStyleChange: (preset) => {
        if (!this.blocklyPanel) return
        if (preset.renderer !== this.blocklyPanel.getRenderer()) {
          this.blocklyPanel.reinitWithPreset(this.callBuildToolbox(), preset)
          this.wireBlocklyChangeHandler()
        }
        this.currentBlockStyleId = preset.id
        this.refreshStatusBar()
      },
      // 🔴 **兩個入口都走偏好那一支**——面板的下拉送的是一個具體語系，
      //    宿主那顆可能送 `follow-host`，而**兩者都是「使用者選的」**。
      onLocaleChange: (locale) => this.applyLocalePreference(locale),
    }
// 🪦 `setupSelectors` 已退場——那四顆下拉變成 `ControlState` 的渲染器
    // （桌機狀態列／IDE 狀態列／行動版設定表）。回呼留著，它們是**共用的那一組**。
    // 🔴 宿主那側的入口——⚠️ 走的是**同一組回呼**。
    this.wireHostControls()
    // 🔴 主控台 ↔ 宿主的終端機——⚠️ 用**能力探測**，這一層不認識任何宿主。
    this.wireHostConsole(elements.consolePanel)
    // 🔴 變數 → 宿主的 `panel` 區（與終端機同一排）。
    elements.variablePanel?.onSnapshot((groups) => this.codeView?.reportVariables?.(groups))
    // 🔴 **暫停中改一個變數 → 匯流排**（2026-08-26）。
    //    面板自己**不認識執行器**——P9：跨層通訊只走 Bus（`principles.md:177`）。
    elements.variablePanel?.onEditValue((name, value) =>
      this.bus.emit('execution:set-variable', { name, value }))
    // 🔴 **流程面板改了一格 → 匯流排**（2026-08-26，(b) 改欄位）。
    //    ⚠️ 走 `edit:tree` 這個**通用**事件，不是 `edit:flow`
    //    ——一個以視圖命名的事件，會逼下一個視圖也要一個自己的名字。
    this.applyLayout = elements.applyLayout
    // ⚠️ `viewId` 要問面板自己，**不是寫死一個字串**（2026-08-27 修）：
    //    寫死的是 `'flow-panel'` 而面板宣告的是 `'flow'`，兩個對不上。
    //    那在 `originViewId` 出現之前沒有人看得出來——因為沒有人讀它。
    //    > **一個沒有人讀的識別字，錯了也不會有人知道。**
    elements.flowPanel?.onEdit((tree) => {
      // 🔴 記住**上一步是誰改的**——`doUndo` 靠它決定要退哪一份堆疊
      this.lastEditor = 'flow'
      this.bus.emit('edit:tree', { viewId: elements.flowPanel?.viewId, tree })
    })
    // 🔴 **流程視圖的編輯在 2026-08-30 之前完全不可還原**（實測：改一個變數名，
    //    按還原，程式碼一個字都沒退回去）——`doUndo()` 就是 `blocklyPanel.undo()`。
    //
    // > **一個編輯得動而還原不了的視圖，比一個唯讀的視圖更危險
    // > ——使用者會以為他隨時可以退回去。**
    // 🔴 **palette 讀工具箱的【輸出】**（2026-08-26，(d)）——不是各自從登錄表算一次。
    this.flowPanel = elements.flowPanel
    this.flowPanel?.setPalette(this.buildToolboxInner())

    // 12. Setup bidirectional highlighting
    this.setupBidirectionalHighlight()

    // 12b. Re-layout Monaco when code tab becomes visible (mobile)
    // Use double-rAF + setTimeout to ensure container is fully painted on real devices
    elements.mobileTabBar?.onTabChange((tab) => {
      if (tab === 'code') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.codeView?.relayout?.())
        })
        // Fallback for devices where rAF fires before paint
        setTimeout(() => this.codeView?.relayout?.(), 100)
      }
    })

    // 13. Update status bar + restore state
    this.refreshStatusBar()
    this.restoreState()
  }

  /**
   * 切換辨識用的文法。**由 `setupCodeToBlocksPipeline` 裝上**——
   * 在它跑之前是 `null`，而那段期間沒有人會切目標。
   */
  private setActiveGrammar: ((language: string) => void) | null = null

  private async setupCodeToBlocksPipeline(): Promise<void> {
    const lifter = new Lifter()
    const transformRegistry = new TransformRegistry()
    registerCoreTransforms(transformRegistry)
    const liftStrategyRegistry = new LiftStrategyRegistry()
    const renderStrategyRegistry = new RenderStrategyRegistry()
    const allSpecs = this.blockSpecRegistry.getAll()
    // 🔴 **各語言的 transform 也要註冊**——C++ 那批由 `registerCppLifters` 順手做，
    // 而那是一個沒有被指名的組裝點。這裡問宣告。
    for (const lp of allLanguagePacks()) lp.liftTransforms?.(transformRegistry)
    const pl = new PatternLifter()
    pl.setTransformRegistry(transformRegistry)
    pl.setLiftStrategyRegistry(liftStrategyRegistry)
    // 🔴 **文法與跳過清單都【問語言套件】，不在這裡硬編。**
    //
    // spec 167 之前這一行是一串 C++ 的節點型別，而**它套用在所有語言上**
    // ——於是 Python 的 `for_statement` 也被跳過，而 `if_statement` 之類
    // 撞名的節點則直接被 C++ 的 pattern 認走：一段 Python 貼進去產出 C++。
    //
    // > **一個組裝點硬編的清單，會安靜地變成所有語言的清單。**
    //
    // ⚠️ **全部語言一起載，切換的是【活躍文法】**——因為這個函式**只跑一次**
    // （init 時），而使用者可以隨時切目標。第一版只載當下那個語言的，
    // 於是切到 Python 之後 lifter 仍然停在 C++ 的文法上，**而畫面是空的**。
    // > **一份「在啟動時決定」的設定，遇到「隨時可以改」的選單就會過期。**
    const skipByGrammar = new Map<string, ReadonlySet<string>>()
    for (const lp of allLanguagePacks()) skipByGrammar.set(lp.grammar, new Set(lp.liftSkipNodeTypes ?? []))
    this.setActiveGrammar = (language: string) => {
      const g = languagePack(language)?.grammar
      if (!g) throw new Error(`沒有語言套件：${language}——辨識不得用猜的文法繼續`)
      pl.setGrammar(g)
      setDegradationLanguage(language)
      setCommentLanguage(language)
      // ⚠️ **兩邊都要切**：pattern 那條路與手寫 lifter 那條路是分開的，
      // 而只切一邊的症狀是「大部分對，少數幾顆仍然是別的語言的」。
      lifter.setGrammar(g)
    }
    this.setActiveGrammar(this.currentTopic.language)
    pl.loadBlockSpecs(allSpecs, skipByGrammar)
    // 🔴 **問套件，不寫死 import**（spec 167）。
    // 在此之前這一行載的永遠是 C++ 的那份，換了語言也一樣。
    pl.loadLiftPatterns(
      allLanguagePacks().flatMap((lp) => lp.liftPatterns ?? []) as unknown as LiftPattern[],
    )
    lifter.setPatternLifter(pl)
    // 🟢 **2026-08-26：從寫死的 `registerCppLifters` 換成問登記表**——與上面
    //    `lp.liftTransforms?.(...)` 同一個形狀（那一格早就是宣告的，而判別與建構
    //    那一整批仍然是「順手註冊」）。
    for (const lp of allLanguagePacks()) {
      lp.installLifters?.(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })
    }
    const pr = new PatternRenderer()
    pr.setRenderStrategyRegistry(renderStrategyRegistry)
    pr.loadBlockSpecsWithTopic(allSpecs, this.currentTopic)
    setPatternRenderer(pr)
    this.patternRenderer = pr
    // 🔴 **解析器依【目前主題的語言】選**——在此之前它寫死 `CppParser`。
    //
    // ⚠️ 而這一行就是 `tree-sitter-python.wasm` **出貨的理由**：
    // `e2e/shipped-assets.spec.ts` 的判準是「出貨的每一個 wasm 都要有人真的去要它」，
    // 而在有這一行之前，Python 的 wasm 放進 `public/` 只是死重
    // ——**護欄當場把它抓出來，那正是它存在的原因。**
    // ⚠️ 這裡仍然先 await 一次——那是為了**及早發現 wasm 抓不到**，
    //    而不是為了把結果留著（那份留著的東西就是剛拆掉的 shim）。
    await this.parserFor(this.currentTopic.language)
    // 🟢 **2026-08-26：那層 shim 拆掉了。**
    //
    //    這裡本來是一個假的 parser——`{ _lastTree, parse() { return { rootNode: this._lastTree } } }`
    //    ——因為 `CodeParser.parse` 宣告成同步，而真的 parser 是非同步的。
    //    於是每個消費者都得先在外面 await、把結果塞進去、再呼叫。
    //    `examples/bring-your-own-view` 有一份**一模一樣的**。
    //
    // > **一個介面如果每個實作者都要在它前面加同一層轉接，
    // > 那層轉接就是介面的一部分。**
    //
    // 🔴 **而「每次都問一次這個語言的解析器」這件事留著**——切目標時語言會變，
    //    而在此之前這裡抓的是啟動時建好的那一顆（寫死 `CppParser`）。
    //    ⚠️ 症狀不是報錯，是**用 C++ 的文法去解析 Python**：
    //    `print("hi")` 會被解析成一個運算式陳述，然後靜靜地降級。
    const codeParser: CodeParser = {
      parse: (code: string) => this.parserFor(this.currentTopic.language).then((p) => p.parse(code)),
    }
    this.syncController!.setCodeToBlocksPipeline(lifter, codeParser)
    const originalSync = this.syncController!.syncCodeToBlocks.bind(this.syncController!)
    const codeView = this.codeView!

    // ⚠️ **這個 wrapper 留著，而它剩下的職責不是轉接**：補相依、保游標、
    //    清那三個旗標——那些是**組裝點的事**，不是 parser 介面的事。
    this.syncController!.syncCodeToBlocks = (codeArg?: string) => {
      const code = codeArg ?? codeView.getCode()
      this._codeToBlocksInProgress = true
      originalSync(code).then(() => {
        const patched = this.syncController?.patchMissingDependencies(code)
        if (patched) {
          const linesDelta = patched.split('\n').length - code.split('\n').length
          this.codeView?.setCodePreserveCursor(patched, linesDelta)
        }
        this.codeDirty = false
        this.blocksDirty = false
        this.updateSyncHints()
        setTimeout(() => { this._codeToBlocksInProgress = false }, 300)
      }).catch((err: unknown) => {
        console.error('Parse error:', err)
        this._codeToBlocksInProgress = false
      })
      return Promise.resolve(false)
    }

    this.syncController!.onError((errors: SyncError[]) => {
      console.warn('Sync errors:', errors.map(e => e.message).join('\n'))
      const monacoEl = document.getElementById('monaco-panel')
      showToast(
        Blockly.Msg['TOAST_ERROR'] || `⚠ ${errors.length} 個語法錯誤`,
        'error',
        monacoEl ?? undefined,
      )
    })
    this.syncController!.setCodingStyle(this.currentStylePreset)
    this.syncController!.onIoConformance((result) => {
      const curIo = this.currentStylePreset.io_style === 'printf' ? 'printf/scanf' : 'cout/cin'
      const altIo = this.currentStylePreset.io_style === 'printf' ? 'cout/cin' : 'printf/scanf'
      if (result.verdict === 'bulk_deviation') {
        const other = STYLE_PRESETS.find(p => p.io_style !== this.currentStylePreset.io_style)
        if (!other) return
        showStyleActionBar(`程式碼大量使用 ${altIo}，但目前風格為 ${curIo}`, [
          { label: `切換到「${other.name['zh-TW'] || other.id}」`, primary: true, action: () => this.applyStylePreset(other) },
          { label: '保持目前風格', action: () => {} },
        ])
      } else if (result.verdict === 'minor_exception') {
        showStyleActionBar(`偵測到少數 ${altIo} 用法（目前風格為 ${curIo}）`, [
          { label: '保留（刻意使用）', action: () => {} },
          { label: `統一為 ${curIo}`, primary: true, action: () => {
            this.syncBlocksToCodeWithMappings()
          }},
        ])
      }
    })
    this.syncController!.onStyleExceptions((exceptions, apply) => {
      showStyleActionBar(`積木風格不符：${exceptions.map(e => `${e.label} → ${e.suggestion}`).join('、')}`, [
        { label: '自動轉換', primary: true, action: () => { apply(); this.syncBlocksToCodeWithMappings() }},
        { label: '保留', action: () => {} },
      ])
    })
  }

  private applyStylePreset(preset: StylePreset): void {
    this.currentStylePreset = preset
    this.syncController?.setStyle(preset)
    this.blocklyPanel?.setCodeContext(this.currentTopic.language, preset)  // 同上
    this.syncController?.setCodingStyle(preset)
    this.refreshStatusBar()
    const ioPref = preset.io_style === 'printf' ? 'cstdio' : 'iostream'
    if (ioPref !== this.currentIoPreference) { this.currentIoPreference = ioPref; this.updateToolbox() }
    this.syncBlocksToCodeWithMappings()
  }

  private getVisibleComponents(): Set<string> {
    const base = getVisibleComponents(this.currentTopic, this.enabledBranches)
    if (!this.currentLesson) return base
    // 🔴 **交集，不是取代**——課宣告了一顆這個目標根本沒有的元件時，
    //    它不該憑空出現。而那種不一致由 `audit-lessons` 那條護欄擋在上游。
    const want = new Set(this.currentLesson.components)
    // 🔴 **鷹架不是學生選的，所以它在【範圍】內——而不在【工具箱】裡。**
    //
    // 這個函式有兩個消費者，而它們要的不是同一件事：
    //
    // ```
    // markOutOfScopeBlocks   畫布上哪幾顆被打暗   → 鷹架【要】在（它是工具自己放的）
    // buildToolboxInner      拖得到什麼           → 鷹架【不要】在（第 1 課不教 #include）
    // ```
    //
    // ⚠️ 2026-08-28 使用者看著畫面問「**為何積木變這麼暗？**」——
    // 根因是第一版把鷹架也濾掉了，於是系統自己產的 `#include` 與
    // `using namespace std;` 被打成 0.35 透明。
    //
    // > **畫面在對學生說「這顆不該在這裡」，而那顆是工具自己放的。**
    //
    // 🔴 而第一版的**修法**也放錯層：補進這裡的話工具箱也跟著多出 `#include`。
    //    收窄工具箱那一半改放 `buildToolboxInner`——那正是它的註解本來就寫著的
    //    「能力過濾只加在這裡，不加進 `getVisibleComponents()`」。
    //
    // 🔴 **問性狀不問身分**（`scaffold`／`scaffoldInMain` 由元件自己宣告）。
    //
    // 🔴 **而性狀只答得出一半**（2026-08-28，使用者：「為何在工具箱還看得到函式？」）：
    //    `cpp:func_def` 沒有 `scaffold` 性狀——它不是「一顆鷹架元件」，
    //    它只是**剛好是骨架的進入點**（`int main()`）。`cpp:return` 也一樣
    //    （它是 `scaffoldInMain`：只有在 main 裡才是骨架）。
    //
    //    於是 65 堂課**每一堂**都得在 `components` 裡列 `func_def` 與 `return`
    //    ——而那張表同時在驅動工具箱，所以第 1 課的工具箱有「函式」那一格。
    //
    // > **一張表扛兩個工作：「畫得出來」與「拿得到」。
    // > 而骨架要前者、不要後者。**
    //
    // 🟢 骨架是誰，`scaffoldNodeIds()` 已經在算了（它問的是**骨架宣告**）。
    //    所以範圍 ＝ 這一課要的 ∪ **畫面上真的是骨架的那幾塊的元件**。
    return new Set([...base].filter((c) =>
      want.has(c) || isScaffoldComponent(c) || this.scaffoldComponentIds().has(c)))
  }

  /**
   * 工具箱該給哪些——**比畫布的範圍再窄一刀**。
   *
   * 選了課的時候，鷹架留在畫布的範圍內（不被打暗），
   * 而**它不進工具箱**：第 1 課不教 `#include`，學生不該拖得到它。
   */
  private toolboxComponents(): Set<string> {
    const visible = this.getVisibleComponents()
    if (!this.currentLesson) return visible
    const want = new Set(this.currentLesson.components)
    return new Set([...visible].filter((c) => want.has(c)))
  }

  /**
   * 積木上要不要看到鷹架（`#include`／`int main()`）。
   *
   * ```
   * 0   剝掉      1   幽靈（看得到、動不了）      2+   可編輯
   * ```
   *
   * ## 🔴 它曾經是 `enabledBranches` 的函數，而那是一個混用
   *
   * 那個集合同時扛了**兩個決定**：
   *
   * ```
   * 哪些元件看得到     ← 使用者 2026-08-28 說的「預設全開」是這一個
   * 鷹架露到第幾層     ← 而它跟著一起變了
   * ```
   *
   * ⚠️ 於是「預設全開」那一刀**連帶把鷹架從「剝掉」變成「可編輯」**，
   * 而症狀離原因很遠：`e2e/debug.spec.ts` 的斷點**停得住**，
   * 而**變數面板是空的**。
   *
   * > **兩個決定共用一個載體時，改動其中一個永遠會偷偷改到另一個。**
   *
   * 🔴 它現在有**自己的一格**（`scaffoldDepth`），語意與拆開前逐字相同：
   *
   * ```
   * 開機          0     剝掉        （舊的預設是只開 L0，深度就是 0）
   * 切過目標之後   max   看得見      （`onTargetChange` 本來就傳全部的層級）
   * ```
   *
   * ⚠️ **兩支 e2e 各要一邊**，而它們都是對的：
   * `debug` 要剝掉（不然變數面板是空的），`include-header-preserved` 要看得見
   * （不然沒有 `#include` 積木可驗）。固定成常數會壞掉其中一支。
   *
   * ⚠️ 而**升高它的使用者入口沒有了**：`branches` 於 2026-08-28 退場。
   *    需要讓學生自己控制的那天，來源是**課**（`pins.scaffoldDepth`），
   *    不是一個沒有人答得出來的打勾清單。
   */
  private getScaffoldDepth(): number {
    return this.scaffoldDepth
  }

  /**
   * 畫布上哪幾塊積木屬於**鷹架**。
   *
   * 🔴 **走樹，不是掃元件身分**——`int main()` 是靠
   * 「函式定義 ＋ 名字叫 main」才成為鷹架的（`cpp-scaffold-filter.ts:20`），
   * 而那是**節點**的性質。只看元件身分的話它會漏掉骨架最重要的那一塊。
   *
   * ⚠️ 而 `return` 只有**在 main 裡面**才是鷹架（`scaffoldInMain`）
   * ——在別的函式裡它是使用者寫的東西。所以這裡要看它的**位置**。
   *
   * 🔴 回的是**節點 id**，由面板自己反查成積木——那份對應住在面板裡
   * （`getNodeIdForBlockId`），組裝點不該複製一份。
   */
  /**
   * 畫布上那幾塊骨架**用到哪些元件**——`scaffoldNodeIds` 的元件版。
   *
   * 🔴 它存在的理由是「**課程不必宣告骨架用了什麼**」：
   * 在此之前 65 堂課每一堂都列著 `func_def` 與 `return`，而那兩顆
   * 沒有一堂在教（除了第 15 課的函式）——它們是 `int main(){ … return 0; }`。
   *
   * ⚠️ 與 `scaffoldNodeIds` **共用同一份走法**（`collect`），
   * 兩份各走一次的話它們遲早會不一致。
   */
  // 🔴 **公開的**——`e2e/lessons.spec.ts` 要問「這一課的哪幾顆是骨架的」，
  //    而它**不該自己再實作一次那條規則**（`history/188`：同一個決定的第六份實作
  //    就是這樣長出來的）。判定本身住在 `core/scaffold-nodes.ts`。
  scaffoldComponentIds(): Set<string> {
    return coreScaffoldComponentIds(this.syncController?.getCurrentTree(), this.currentSkeletonId)
  }

  /**
   * 畫布上哪幾塊積木屬於**骨架**——判定住在 `core/scaffold-nodes.ts`。
   *
   * 🔴 **這裡曾經是那份判定的家**，而 2026-08-30 流程視圖也要問同一件事
   * ——搬進 core 而不是複製一份（`history/188`：那個決定曾經有六份實作）。
   */
  private scaffoldNodeIds(): Set<string> {
    return coreScaffoldNodeIds(this.syncController?.getCurrentTree(), this.currentSkeletonId)
  }

  private markOutOfScopeBlocks(): void {
    this.blocklyPanel?.markOutOfScopeBlocks(this.getVisibleComponents())
    // 🔴 **鷹架的顯示模式也在這裡套用**——與「超出範圍」同一個時機
    //    （畫完之後在既有的積木上蓋一層視覺）。
    this.blocklyPanel?.markScaffoldBlocks(
      this.scaffoldNodeIds(),
      this.scaffoldDepth === 1 ? 'ghost' : 'editable',
    )
  }

  private reloadBlockSpecsForTopic(): void {
    if (!this.patternRenderer) return
    const allSpecs = this.blockSpecRegistry.getAll()
    this.patternRenderer.loadBlockSpecsWithTopic(allSpecs, this.currentTopic)
  }

  /**
   * 建工具箱——**而它的輸出同時餵給流程視圖的 palette**（2026-08-26）。
   *
   * 🔴 餵的是**輸出**不是登錄表：各自從登錄表算一次的話，同一份來源會長出
   * 兩份篩選與排序邏輯，而分岔的症狀是「工具箱有而 palette 沒有」
   * ——**沒有人會發現，因為兩邊都看起來對**。
   */
  private callBuildToolbox(): object {
    const built = this.buildToolboxInner()
    // ⚠️ 第一次呼叫發生在 `createAppLayout(...)` 的**參數裡**——那時面板還不存在。
    //    所以這裡是「有就餵」，而首次的那一份由接線的地方補送（見 `flowPanel.setPalette`）。
    this.flowPanel?.setPalette(built)
    return built
  }

  private buildToolboxInner(): object {
    return buildToolbox({
      blockSpecRegistry: this.blockSpecRegistry,
      // 🔴 **能力過濾只加在這裡，不加進 `getVisibleComponents()`。**
      //
      // 那個函式同時餵給 `markOutOfScopeBlocks()`（畫布上的灰階標記），
      // 而把板子過濾加進去會讓**畫布上既有的積木變灰**——那不是本刀的需求，
      // 而且它與既有行為衝突：「workspace 既有積木不受層級切換影響
      // （只影響 toolbox 可用性）」。
      //
      // ⚠️ 學生在 ESP32 下拉了一顆觸摸積木、切到 Uno，**那顆積木要留在畫布上**
      // ——切走一個目標不該吃掉他的作品。
      // 🔴 **課的收窄在這裡再切一刀**——`getVisibleComponents()` 為了畫布
      //    留著鷹架，而工具箱不該讓學生拖得到 `#include`（見那個函式的註解）。
      visibleComponents: filterByTarget(this.toolboxComponents(), this.currentTarget),
      ioPreference: this.currentIoPreference,
      msgs: Blockly.Msg as Record<string, string>,
      categoryColors: CATEGORY_COLORS,
      // 🔴 **依目標的語言選分類**，不再寫死 cpp。
      //
      // ⚠️ 不能用「全部語言的聯集」——那會讓 C++ 使用者的工具箱
      // 多出一個空的「輸入輸出」分類（spec 160 實測，工具箱快照當場紅）。
      // > **一個沒有積木的分類是一個空段落。**
      categoryDefs: languagePack(this.currentTopic.language)?.categories ?? [],
    })
  }

  /** Resync blocks/code after topic/branch change; async-parses if needed for depth 0→1+ */
  private resyncAfterTopicChange(): void {
    // 🔴 **安全網原本只掛在 `syncBlocksToCodeWithMappings` 一條路上**（2026-08-24 補）。
    //    這一條同樣是「從積木產生程式碼並寫回去」，而它一次都沒問過工作區殘不殘
    //    ——`setState` 失敗（載了一半）之後走到這裡，半份積木照樣蓋掉程式碼。
    //
    // > **一張只蓋住一條路的安全網，與沒有安全網的差別，
    // > 只在缺陷走的是哪一條路。**
    //
    // ⚠️ 只擋 `load-failed`：`not-rendered` 在還原路徑上是**正常的**
    //    （積木剛 `setState` 進來、匯流排還沒畫），而這一條正是那時候
    //    負責把程式碼生出來的人。
    if (this.blocklyPanel?.staleReason === 'load-failed') return
    const tree = this.blocklyPanel?.extractSemanticTree()
    if (!tree) return
    const code = this.codeView?.getCode() ?? ''
    // 🪦 這裡本來算一個 `needsRelift`，**算完就 `void` 掉**（2026-08-26 起）
    //    ——`resyncForTopic` 自己會判同一件事。
    //    🔴 而它裡面寫死了 `name === 'main'`，於是它是「哪一塊是骨架」
    //    這個決定的**第四份實作**——一份沒有人用的實作。
    //
    // > **一段算完就丟掉的判斷，仍然會被當成規範讀。**
    this.syncController?.resyncForTopic(tree, code)
  }

  /** Extract tree + blockMappings and sync to code */
  /**
   * 換目標——課程清單、風格、鷹架深度一起換。
   *
   * 🔴 這段是從選擇器的 closure **搬**出來的（不是複製），因為現在有**兩個**
   * 呼叫端：使用者在選擇器上選，以及**宿主用組態指定**（`applyHostConfig`）。
   *
   * > **同一件事有兩個入口時，要嘛共用一個實作，
   * > 要嘛就會有兩個「換目標之後畫面長什麼樣」的真相。**
   */
  /**
   * 這個語言的解析器——**一個語言一顆，載入過就留著**。
   *
   * ⚠️ `init()` 要抓 wasm，切一次目標就重載一次會很痛；
   * 而快取讓 `tree-sitter-python.wasm` **只在第一次切到 Python 時被要**
   * ——那正是 `e2e/shipped-assets.spec.ts` 要看到的那一次請求。
   */
  private parsers = new Map<string, { parse(code: string): Promise<{ rootNode: unknown }> }>()

  private async parserFor(language: string): Promise<{ parse(code: string): Promise<{ rootNode: unknown }> }> {
    const hit = this.parsers.get(language)
    if (hit) return hit
    const pack = languagePack(language)
    // 🔴 **沒有這個語言的套件就丟錯，不猜一個**（P6：禁止給出看起來合理的結構）。
    // 猜 `CppParser` 的話症狀是「用 C++ 的文法解析 Python」——安靜地全部降級。
    if (!pack) throw new Error(`沒有語言套件：${language}`)
    const made = pack.createParser()
    await made.init()
    this.parsers.set(language, made)
    return made
  }

  private handleTargetChange(target: Target, topic: Topic, branches: Set<string>): void {
    // 🔴 **目標自己說它要不要程式外殼**——這一層不認識任何具體的目標。
    this.adoptSkeleton(target.skeleton ?? 'main')
        const prevDepth = this.getScaffoldDepth()
        this.currentTarget = target
        this.currentTopic = topic
        this.enabledBranches = branches
        // ⚠️ **與拆開前逐字相同**：`onTargetChange` 傳的是全部的層級，
        //    而舊的 `getScaffoldDepth()` 讀它 → 切過目標之後鷹架看得見。
        this.scaffoldDepth = Math.max(
          ...flattenLevelTree(topic.levelTree)
            .filter((n) => branches.has(n.id))
            .map((n) => n.level), 0)
        // 風格那一半——走既有的 `applyStylePreset`（它同時更新選擇器的顯示值）
        const style = STYLE_PRESETS.find(p => p.id === target.style)
        if (style && style.id !== this.currentStylePreset.id) this.applyStylePreset(style)
        const newDepth = this.getScaffoldDepth()
        setScaffoldConfig({ scaffoldDepth: newDepth })
        // ⚠️ **換到沒有替換表的目標時要真的清掉**——否則上一塊板子的替換會留著。
        setHeaderAliases(target.headerAliases)
        // 🔴 **切目標可能就是切語言**——而在 spec 161 之前**沒有人叫這兩個 setter**：
        // `SyncController` 與積木面板從啟動起就一直拿著 `'cpp'`。
        // ⚠️ 症狀不是報錯：`generateCodeWithMapping(tree, 'cpp', …)` 對 Python 的樹
        // **照樣產得出東西**（產生器是按元件身分查的），只是那個語言參數是錯的。
        // > **一個從來沒有人呼叫的 setter，與一個不存在的機制分不出來。**
        // 🔴 **辨識用的文法也要跟著切**（spec 167）——與上面那兩個 setter 同一個理由，
        // 而它的症狀更狠：文法不對時**一顆積木都畫不出來**（全部不匹配）。
        this.setActiveGrammar?.(topic.language)
        this.syncController?.setLanguage(topic.language)
        this.blocklyPanel?.setCodeContext(topic.language, this.currentStylePreset)
        this.syncController?.setTopic(topic, branches)
        this.syncController?.setScaffoldDepth(this.scaffoldDepth)
        this.reloadBlockSpecsForTopic()
        this.updateToolbox()
        this.markOutOfScopeBlocks()
        if (!this._restoringState) {
          // Full resync only when scaffold depth crosses the 0 boundary
          // (blocks need scaffold wrapping/unwrapping). Otherwise just regen code.
          if ((prevDepth === 0) !== (newDepth === 0)) {
            this.resyncAfterTopicChange()
          } else {
            this.syncBlocksToCodeWithMappings()
          }
        }
        this.refreshStatusBar()
        // ⚠️ **選擇本身要存**——`autoSave` 只掛在積木變動上（`blocklyPanel.onChange`），
        // 所以在空白工作區換目標，重新整理之後就跑掉了。
        // 🔴 那是既有的缺口（`topicId`／`styleId` 也一樣），而 e2e 才問得出來。
        if (!this._restoringState) this.autoSave()
  }

  /**
   * 照宿主給的組態選目標。
   *
   * ## 🔴 為什麼非有不可
   *
   * 使用者在 Arduino IDE 裡開 `.ino`，而面板用的是 `C++（預設）` 這個目標
   * ——於是**鷹架把 `setup()`／`loop()` 包進了 `int main()`**，
   * 並且加上 `using namespace std;`。⚠️ 那不是顯示問題，**它寫進了使用者的檔案**。
   *
   * `semorphe.target` 這個設定**早就宣告了**（`manifest.ts`），
   * 而 spec 140 把 webview 縮成薄殼時，消費它的那一段掉了
   * ——於是它變成一個**宣告了而沒有人讀**的設定。
   *
   * > **一個沒有人讀的設定，與一個不存在的設定，
   * > 差別只在前者讓人以為已經處理過了。**
   *
   * ⚠️ 認不得的 ID **回退到現況**，不崩潰也不留空白（與 `restoreState` 同一條規矩）。
   */
  applyHostConfig(cfg: { targetId?: string; locale?: string; hostLocale?: string }): void {
    // 🔴 語系先處理——⚠️ 它與目標**互不相干**，而早期的版本因為
    //    `if (!cfg.targetId) return` 寫在最前面，讓它整段被跳過。
    if (cfg.hostLocale) this.hostLocale = cfg.hostLocale
    if (cfg.locale && cfg.locale !== this.localePreference) void this.applyLocalePreference(cfg.locale)
    if (!cfg.targetId) return
    const target = this.targetRegistry.get(cfg.targetId)
    if (!target || target.id === this.currentTarget.id) return
    const topic = this.topicRegistry.get(target.topic)
    if (!topic) return
    // 🔴 **不得由此寫回文件。** `handleTargetChange` 在正常路徑上會
    //    `syncBlocksToCodeWithMappings()`——而套用組態發生在**開機時**，
    //    那時工作區是空的，寫回去就是**把使用者的檔案清空**。
    //
    // > **一個「換設定」的動作如果順手寫了檔案，
    // > 那麼在還沒讀到檔案之前換設定，就會把檔案寫成還沒讀到的樣子。**
    //
    // ⚠️ 借用既有的 `_restoringState`（它正是「現在不要寫回去」的意思），
    //    不新開一個旗標——兩個意思一樣的旗標會各自漂移。
    this._restoringState = true
    try {
      this.handleTargetChange(target, topic, new Set([topic.levelTree.id]))
    } finally {
      this._restoringState = false
    }
  }

  private syncBlocksToCodeWithMappings(): void {
    // 🔴 **殘的工作區不得覆蓋程式碼。**
    //
    // `BlocklyPanel` 從語義樹載入積木失敗時只載了一半，而把那半份產生成程式碼
    // 寫回去，等於**把使用者的檔案刪掉一半**。
    //
    // > **兩邊不一致時，不能拿「已知是壞的那一邊」當來源。**
    //
    // ⚠️ 恢復的辦法是從**同步選單**選「以此為準：程式碼」重載一次（成功就會解除）。
    //    🔴 這一行原本寫「按『程式碼→積木』」——而那顆按鈕 2026-08-25 退場了。
    //    **一條指向不存在的按鈕的錯誤訊息，比沒有訊息更糟。**
    // ⚠️ **兩種殘只有一種該出聲**（2026-08-24，使用者：「每次重新整理都會跳出一條」）：
    //    開機時工作區還沒被畫過，那是**正常的過渡狀態**——擋住寫回是對的，
    //    而對使用者喊「積木沒有完整載入」是錯的。見 `staleReason`。
    const stale = this.blocklyPanel?.staleReason
    if (stale) {
      if (stale === 'load-failed') {
        showToast('積木沒有完整載入，暫停同步到程式碼——請從同步選單選「以此為準：程式碼」重載', 'error')
      } else {
        // 🟢 不出聲，而**不是靜默**：留一行給開發者，使用者不需要看到它
        console.debug('[semorphe] 工作區還沒畫過，這一次不寫回程式碼（開機時的正常狀態）')
      }
      return
    }
    const tree = this.blocklyPanel?.extractSemanticTree()
    const blockMappings = this.blocklyPanel?.getBlockMappings()
    this.syncController?.syncBlocksToCode(tree, blockMappings)
  }

  private updateToolbox(): void {
    const ws = this.blocklyPanel?.getWorkspace()
    if (!ws) return
    ws.updateToolbox(this.callBuildToolbox() as Blockly.utils.toolbox.ToolboxDefinition)
  }

  private wireBlocklyChangeHandler(): void {
    this.blocklyPanel?.onChange(() => {
      // 🔴 積木那側改過了 → 上一步不再是流程的（見 `doUndo`）
      this.markBlocksEdited()
      if (this._codeToBlocksInProgress) return
      // 🔴 **記錄「誰編輯了」要在殘態守衛【之前】**（2026-08-25 瀏覽器實測抓到）。
      //
      // 下面那個守衛擋的是「殘的工作區不得**覆蓋程式碼**」——那是對的。
      // 而第一版把 `noteEdit` 放在它後面，於是**暫停期間的積木編輯完全沒被記錄**
      // （暫停時工作區還沒被匯流排畫過，`staleReason === 'not-rendered'`），
      // 分岔因此永遠偵測不到。
      //
      // > **「不要拿它去寫」與「不要記得它被改過」是兩件事，
      // > 而一個 early return 把它們寫成了同一件。**
      this.syncCoordinator.noteEdit(this.blocklyPanel?.viewId ?? 'blockly-panel')
      // 🔴 同 `syncBlocksToCodeWithMappings`：殘的工作區不得覆蓋程式碼。
      //    ⚠️ 自動同步這條路才是真正危險的——它不需要使用者按任何東西。
      if (this.blocklyPanel?.isStateStale) return
      this.blocksDirty = true; this.updateSyncHints()
      if (this.autoSync) {
        const tree = this.blocklyPanel?.extractSemanticTree()
        const blockMappings = this.blocklyPanel?.getBlockMappings()
        this.syncController!.syncBlocksToCode(tree, blockMappings)
        this.blocksDirty = false; this.updateSyncHints()
      }
      this.runAllDiagnostics(); this.autoSave()
    })
  }

  /**
   * 重畫狀態列——**面板那條與宿主那條，由同一個函式寫**。
   *
   * 🔴 原本它們是兩個函式（`refreshStatusBar` ／ `refreshSyncStatus`），
   * 而**開機那條路徑只呼叫了其中一個**：於是擴充裡的宿主狀態列
   * 在使用者主動去動同步之前**一格都沒有**——而面板裡那條照常畫著。
   *
   * > **同一份狀態的兩個投影，如果由兩個函式寫，
   * > 遲早會有一條路徑只走到其中一個。**
   */
  private refreshStatusBar(): void {
    const detail = updateStatusBar(this.currentStylePreset, this.currentLocale, this.currentBlockStyleId, this.currentTopic.name,
      languagePack(this.currentTopic.language)?.name ?? this.currentTopic.language,
      // 🔴 三態要**一直看得見**——一個沒被顯示的狀態，使用者會當成壞掉
      this.syncCoordinator.snapshot(),
      // 目標的名字——讓那一格判斷得出自己是不是廢話（見 `updateStatusBar`）
      this.currentTarget.name)
    // 🔴 **宿主那條也是同一份狀態的投影**——⚠️ 用能力探測，
    //    這一層不認識任何一個具體的宿主（`host-profile.ts`：id 不得拿來分支）。
    const snapshot = this.syncCoordinator.snapshot()
    this.codeView?.reportSyncPhase?.(snapshot.phase, snapshot.source, detail)
    // 🔴 **控制項也是同一份狀態的投影**——同一個函式寫，理由見上面那段。
    this.publishControls()
  }

  // 🔴 三顆視圖動作——**兩個入口共用**（面板的快速列 · 宿主的分頁標題列）。
  /**
   * **還原**——而「還原什麼」由**最後編輯的是誰**決定。
   *
   * 🔴 這個 app 有兩份堆疊：Blockly 自己的（積木），與 `SyncController` 的
   * 樹歷史（流程視圖，2026-08-30 加的）。
   *
   * ⚠️ 把它們合成一份是另一刀——今天先讓那顆按鈕**做對的那一件事**：
   * 上一步是在流程改的，就退流程那一步。
   *
   * > **兩份歷史合成一顆按鈕，最糟的答案是「永遠退其中一份」
   * > ——那讓另一份的每一步都變成不可逆。**
   */
  /**
   * **上一步是在哪一個視圖做的**——那一對按鈕靠它決定要退哪一份堆疊。
   *
   * 🔴 三份堆疊**沒辦法真的合成一份**，因為它們的「一步」不是同一個東西：
   *
   * ```
   * code    一次打字（字元群組）——編輯器自己的顆粒度最好
   * blocks  一次工作區事件
   * flow    一次語義樹的改動（而版面位移根本不在樹裡）
   * ```
   *
   * > **能共用的是那一對【按鈕】，不是底下的歷史。**
   *
   * ⚠️ 而這個轉送是**近似的**：連按兩次可能跨到另一份堆疊。
   * 代價換到的是「畫面上只有一對按鈕」，而那比三對一致得多。
   */
  private lastEditor: 'code' | 'blocks' | 'flow' | null = null

  /** 積木那側改過了。 */
  private markBlocksEdited(): void { this.lastEditor = 'blocks' }

  private doUndo(): void {
    if (this.lastEditor === 'code' && this.codeView?.undo) { this.codeView.undo(); return }
    if (this.lastEditor === 'flow' && this.syncController?.undoTree()) return
    this.blocklyPanel?.undo()
  }

  private doRedo(): void {
    if (this.lastEditor === 'code' && this.codeView?.redo) { this.codeView.redo(); return }
    if (this.lastEditor === 'flow' && this.syncController?.redoTree()) return
    this.blocklyPanel?.redo()
  }
  private doClear(): void { this.blocklyPanel?.clear() }

  /**
   * 把控制項的完整狀態交給宿主——🔴 **與面板那條狀態列由同一個函式驅動**。
   *
   * ⚠️ 這一條是同一天學到的教訓的第二次應用：
   *
   * > **同一份狀態的兩個投影，如果由兩個函式寫，
   * > 遲早會有一條路徑只走到其中一個。**
   *
   * ⚠️ **`indicator` 不在這裡送**——同步三態走自己的頻道
   * （`reportSyncPhase`，它有三態與 tooltip 的契約）。兩邊都送的話，
   * 宿主的狀態列會出現**兩個同步項目**。
   */
  private publishControls(): void {
    if (!this.controlCallbacks) return
    const surfaces = this.profile.controlSurfaces
    // ⚠️ `indicator` 不在這裡送——同步三態走自己的頻道（見上）。
    // 🔴 只有 `picker` 與 `action` 是**使用者按的東西**。
    //    ⚠️ `indicator` 有自己的頻道；`output` 是一條資料流，不是一顆控制項
    //       ——把它當控制項送出去，宿主會替它產生一個按了沒事的指令。
    // 🔴 **被課釘住的控制項【消失】**——濾在這裡，桌機狀態列與宿主狀態列
    //    兩個表面同時生效（它們讀的是同一份 `ControlState`）。
    //
    // ⚠️ `ControlSurface` 的六個值全部是「畫在哪」，**沒有一個是「不畫」**
    //    ——所以「消失」必須在產生清單的這一步做，不能靠換一個 surface。
    const pinned = new Set(this.currentLesson ? controlsPinnedBy(this.currentLesson) : [])
    // 🔴 **「章節」與「範例」佔同一格，不同時出現。**
    //    那一格問的是同一件事——「我從什麼開始」——只是有課的時候由課回答。
    pinned.add(this.currentTrack ? 'template' : 'lesson')
    const pickersAndActions = CONTROLS
      .filter((c) => c.kind === 'picker' || c.kind === 'action')
      .filter((c) => !pinned.has(c.id))

    // ① 交給宿主的那些
    const toHost = pickersAndActions
      .filter((c) => surfaceOf(c, surfaces).startsWith('host'))
      .map((c) => this.controlStateOf(c))
    if (toHost.length > 0) this.codeView?.reportControls?.(toHost)

    // ② 畫在**面板自己的狀態列**上的那些——🔴 讀的是**同一份 `ControlState`**。
    //    > 兩邊長得一樣，不是因為有人照著抄，是因為它們畫的是同一份東西。
    const onBar = pickersAndActions
      .filter((c) => surfaceOf(c, surfaces) === 'panelStatusBar')
      .map((c) => this.controlStateOf(c))
    if (onBar.length === 0) return
    const invoke = (i: ControlInvoke): void => this.handleControlInvoke(i)
    const slot = document.getElementById('status-controls')
    if (slot) renderStatusControls(slot, onBar, invoke)
    // ③ 行動版的設定——🔴 **不預先畫**：它是一張按了才開的 QuickPick，
    //    所以這裡只把最新的一份**存起來**，開的時候才用。
    //
    // ⚠️ 存的是**每次重畫後最新的那一份**——一張開著的清單顯示過期的值，
    //    比沒有那張清單更糟。
    this.latestControlStates = onBar
  }

  /** 一顆控制項現在的樣子 ＋ **它的值域**。 */
  private controlStateOf(spec: ControlSpec): ControlState {
    const title = spec.hostTitle
    switch (spec.id) {
      case 'target': {
        // 🔴 **分組，而組序是宣告的**——`targetRegistry.all()` 的順序是註冊順序，
        //    而「程式語言在硬體前面」是一個**設計**，不該靠註冊順序碰巧成立。
        //
        // ⚠️ 沒宣告 `group` 的目標排在最後（保守）——新增一個語言套件而忘了
        //    填 group 時，它會出現在清單末尾**而不是消失**。
        const GROUP_ORDER = ['程式語言', '硬體']
        const rank = (g?: string): number => {
          const i = GROUP_ORDER.indexOf(g ?? '')
          return i < 0 ? GROUP_ORDER.length : i
        }
        const options: ControlOption[] = [...this.targetRegistry.all()]
          // 🔴 **`listed: false` 的不列**——它們仍然是完整的目標，
          //    只是【只由課程進得去】（`cpp-advanced` 是一條軌道不是語言；
          //    `arduino` 沒有板子常數，是一個陷阱）。
          //
          // ⚠️ 而**目前用著的那一個一定要列**——否則選單上看不到自己在哪，
          //    那正是「選了課程之後目標就不見了」那個病的另一個形狀。
          .filter((t) => t.listed !== false || t.id === this.currentTarget.id)
          .map((t, i) => ({ t, i }))
          // ⚠️ **組間看 `group`，組內看 `order`**——兩個都是宣告的。
          //    註冊順序是套件裡 `import` 的順序（依賴關係），**不是教學順序**：
          //    實測不排的話 `C++ 進階` 會跑到 `C` 後面。
          //    沒宣告 `order` 的排最後（`i` 當尾綴，讓它至少穩定）。
          .sort((a, b) =>
            rank(a.t.group) - rank(b.t.group) ||
            (a.t.order ?? 1e9) - (b.t.order ?? 1e9) ||
            a.i - b.i)
          .map(({ t }) => ({ value: t.id, label: t.name, group: t.group, description: t.hint }))
        return { id: spec.id, kind: spec.kind, title, label: this.currentTarget.name, value: this.currentTarget.id, options }
      }
      // 🪦 `branches` 的 `ControlState` 已隨那顆控制項於 2026-08-28 退場。
      case 'track': {
        const tracks = [...allTracks().values()]
        const options: ControlOption[] = [
          { value: '', label: '（不選課程）' },
          ...tracks.map((t) => ({
            value: t.id,
            label: `${t.name}（${lessonsOfTrack(t.id).length} 章）`,
            description: t.description,
          })),
        ]
        const cur = this.currentLesson ? allTracks().get(trackOf(this.currentLesson.id)) : undefined
        return {
          id: spec.id, kind: spec.kind, title,
          // 🔴 **祈使句，不是狀態句**（2026-08-28 使用者：「不要說『沒有課程』要說『選擇課程』」）。
          //    「沒有課程」讀起來像「**沒有課程可選**」——一句在勸退的話，
          //    而那一格其實是一個邀請。
          label: cur?.name ?? '選擇課程', value: cur?.id ?? '', options,
        }
      }
      case 'scaffold': {
        // 🔴 **兩個軸，兩個群組，而值用前綴分開**（`skeleton:` / `mode:`）。
        //    一次點擊只改一個軸——混在一起的話「我剛剛改了什麼」會說不清楚。
        const cur = skeletonById(this.currentSkeletonId)
        const mine = skeletonsOfLanguage(this.currentTopic.language)
        // 🔴 **`hidden` 不是每一種骨架都做得到**（2026-08-28）：
        //    Arduino 有兩個進入點，兩批語句攤平成一串之後**分不回去**
        //    ——那不是「藏起來」，是把資訊弄丟。
        //    使用者：「這也會**被你選什麼目標限制有哪些選擇**」。
        const MODES: readonly [ScaffoldMode, string, string][] = [
          ...(canHideScaffold(cur)
            ? [['hidden', '隱藏', '積木上只留你自己的邏輯'] as [ScaffoldMode, string, string]]
            : []),
          ['ghost', '淡的', '看得到、動不了，旁邊寫著為什麼'],
          ['editable', '完整', '整支程式，你改得動'],
        ]
        const mode: ScaffoldMode =
          this.scaffoldDepth === 0 ? 'hidden' : this.scaffoldDepth === 1 ? 'ghost' : 'editable'
        const options: ControlOption[] = [
          // ⚠️ **骨架只列這個【語言】有的**——`main` 與 `none` 都是 C++ 的，
          //    而 Arduino 的目標與 C++ 是同一個語言。
          ...mine.map((s) => ({
            value: `skeleton:${s.id}`, label: s.name, group: '骨架',
            // 🔴 **說明由宣告自己說**——第一版用「entryPoint 是空的」推導成
            //    「Arduino sketch」，而 Python 的空骨架也被說成 Arduino。
            description: s.hint,
          })),
          ...MODES.map(([m, label, desc]) => ({
            value: `mode:${m}`, label, group: '顯示', description: desc,
          })),
        ]
        return {
          id: spec.id, kind: spec.kind, title,
          // 🔴 標籤同時說出**兩個軸**——「目前是哪一種」問的就是這兩格
          label: `${cur?.name ?? this.currentSkeletonId}・${MODES.find(([m]) => m === mode)?.[1] ?? mode}`,
          value: `mode:${mode}`,
          options,
        }
      }
      case 'template': {
        const mine = [...allTemplates().values()].filter((t) => t.target === this.currentTarget.id)
        const options: ControlOption[] = mine.map((t) => ({
          value: t.id,
          label: t.name,
          group: t.group,
          description: t.description,
        }))
        return {
          id: spec.id, kind: spec.kind, title,
          // 🔴 **不記住選了哪一份**——套用之後那份程式碼就是使用者的了，
          //    他改了兩行之後選單還顯示「空白程式」是一句謊話。
          label: '選擇範例', value: '', options,
        }
      }
      case 'lesson': {
        // 🔴 **只列【目前這條軌道】的章節**——不是全部 65 堂。
        //    列全部的話，選單本身就變成一個新的認知負擔，
        //    而那正是這一整刀在拆的東西。
        const tid = this.currentTrack ?? (this.currentLesson ? trackOf(this.currentLesson.id) : undefined)
        const mine = tid ? lessonsOfTrack(tid) : []
        const options: ControlOption[] = mine.map((l) => ({
          value: l.id,
          // ⚠️ 資料夾名的 `NN-` 前綴留著——它就是章節編號
          label: `${l.id.split('/')[1] ?? l.id}${l.estimate ? `　${l.estimate}` : ''}`,
        }))
        return {
          id: spec.id, kind: spec.kind, title,
          // 🔴 沒選課程的時候這一顆說「先選課程」而不是「沒有章節」
          //    ——後者看起來像「這條軌道是空的」。
          // 同上——祈使句。⚠️ 而「還沒選課程」那一支現在到不了
          //    （沒選課程時這一顆整個不畫，見 `publishControls`）。
          label: this.currentLesson ? this.currentLesson.title : '選擇章節',
          value: this.currentLesson?.id ?? '',
          options,
        }
      }
      case 'layout': {
        // 🔴 標籤走 i18n 鍵（`nameKey`），**不得把 id 印上畫面**
        //    ——第八十一條護欄的硬性零盯著這一點。
        const cur = layoutPreset(this.currentLayout) ?? LAYOUT_PRESETS[0]
        return {
          id: spec.id, kind: spec.kind, title,
          label: msg(cur.nameKey, cur.id), value: cur.id,
          options: LAYOUT_PRESETS.map((p) => ({ value: p.id, label: msg(p.nameKey, p.id) })),
        }
      }
      case 'style': {
        const name = (p: StylePreset): string => p.name[this.currentLocale] || p.name['zh-TW'] || p.id
        return {
          id: spec.id, kind: spec.kind, title,
          label: name(this.currentStylePreset), value: this.currentStylePreset.id,
          options: STYLE_PRESETS.map((p) => ({ value: p.id, label: name(p) })),
        }
      }
      case 'blockStyle':
        // 🔴 值域**問已經有它的那個類別**——不為了一份清單多 import 一次語言套件。
        return {
          id: spec.id, kind: spec.kind, title,
          label: BlockStyleSelector.labelOf(this.currentBlockStyleId),
          value: this.currentBlockStyleId,
          options: BlockStyleSelector.options(),
        }
      case 'locale': {
        const picked = LOCALES.find((l) => l.id === this.localePreference)
        return {
          id: spec.id, kind: spec.kind, title,
          // 🔴 跟隨時要**看得出跟到了什麼**——只寫「跟隨宿主」的話，
          //    使用者無從知道它解析成哪一個。
          label: this.localePreference === FOLLOW_HOST_LOCALE
            ? `${picked?.label ?? FOLLOW_HOST_LOCALE}（${this.currentLocale}）`
            : (picked?.label ?? this.currentLocale),
          value: this.localePreference,
          options: LOCALES.map((l) => ({ value: l.id, label: l.label })),
        }
      }
      default:
        // action：`run` / `undo` / `redo` / `clear`
        return { id: spec.id, kind: spec.kind, title, label: title }
    }
  }

  /**
   * 接宿主那側按下的控制項。
   *
   * 🔴 **走的是與面板下拉同一組回呼**——不是第二條路。
   */
  private wireHostControls(): void {
    this.codeView?.onControlInvoke?.((invoke) => this.handleControlInvoke(invoke))
  }

  /**
   * 按了一顆控制項——**宿主的 QuickPick 與網頁版狀態列走同一支**。
   *
   * 🔴 走的是與面板下拉同一組回呼，不是第二條路。
   */
  private handleControlInvoke(invoke: ControlInvoke): void {
    {
      const cb = this.controlCallbacks
      if (!cb) return
      switch (invoke.id) {
        case 'target': {
          // 🔴 **換目標就退出課程**——課的清單是跟著目標走的
          //    （使用者拍板的順序：「先選目標再選課程」）。
          //    留著它的話，畫面會顯示一堂**不屬於這個目標**的課。
          this.currentLesson = undefined
          this.currentTrack = undefined
          const target = this.targetRegistry.get(invoke.value ?? '')
          const topic = target ? this.topicRegistry.get(target.topic) : null
          if (!target || !topic) return
          cb.onTargetChange(target, topic, new Set(flattenLevelTree(topic.levelTree).map((n) => n.id)))
          break
        }
        case 'scaffold': {
          const v = invoke.value ?? ''
          if (v.startsWith('skeleton:')) this.setSkeleton(v.slice(6))
          else if (v.startsWith('mode:')) this.setScaffoldMode(v.slice(5) as ScaffoldMode)
          break
        }
        case 'template': {
          this.applyTemplate(invoke.value ?? '')
          break
        }
        case 'track': {
          this.selectTrack(invoke.value ?? '')
          break
        }
        case 'lesson': {
          this.selectLesson(invoke.value ?? '')
          break
        }
        case 'style': {
          const style = STYLE_PRESETS.find((p) => p.id === invoke.value)
          if (style) cb.onStyleChange(style)
          break
        }
        case 'blockStyle': {
          const preset = BlockStyleSelector.byId(invoke.value ?? '')
          if (preset) cb.onBlockStyleChange(preset, {})
          break
        }
        case 'locale':
          // ⚠️ 與其餘四顆同形——都走 `controlCallbacks`，沒有第二條路。
          if (invoke.value) void cb.onLocaleChange(invoke.value)
          break
        case 'run':
          this.executionController?.runFromHost(invoke.value)
          break
        case 'undo': this.doUndo(); break
        case 'redo': this.doRedo(); break
        case 'clear': this.doClear(); break
        // 🔴 editor 區看哪一個投影——積木（空間層）／流程（關係層）
        case 'viewBlocks': this.showProjection?.('blocks'); break
        case 'viewFlow': this.showProjection?.('flow'); break
        case 'layout': {
          const id = (invoke.values?.[0] ?? invoke.value) as LayoutPresetId | undefined
          if (id && layoutPreset(id)) {
            this.currentLayout = id
            this.applyLayout?.(id)
            // 🔴 **重畫控制項**——不然狀態列還顯示上一個版面的名字。
            //    ⚠️ 那不是「沒更新」，是**它在說謊**：畫面已經是三欄而它寫著對照。
            this.publishControls()
          }
          break
        }
      }
    }
  }

  /**
   * 把主控台接到宿主的終端機。
   *
   * 🔴 **鏡射，不是搬家**：面板那一格建不建由
   * `controlSurfaces.output` 決定，而輸出**兩邊都收得到**
   * ——那讓「面板那格被關掉」與「終端機沒接上」分得出來。
   *
   * ⚠️ 輸入走 `feedInput`，而它與面板那顆輸入框**共用同一個 resolve**：
   *
   * > **同一件事有兩個入口時，要嘛共用一個實作，
   * > 要嘛就會有兩個「誰在等輸入」的真相。**
   */
  private wireHostConsole(consolePanel: ConsolePanel | null): void {
    const view = this.codeView
    if (!consolePanel || !view?.reportConsole) return
    consolePanel.onOutput((chunk: string) => view.reportConsole?.(chunk))
    // 🔴 宿主打不開終端機 → 主控台還給面板（Arduino IDE，2026-08-25 實測）。
    //    🟢 而輸出不會掉：`ConsolePanel` 一直都在畫，終端機只是它的鏡射。
    view.onConsoleFallback?.(() => this.enableConsoleTab?.())
    consolePanel.onClear(() => view.clearConsole?.())
    consolePanel.onInputRequested((prompt) => view.reportConsoleAwaitingInput?.(prompt))
    view.onConsoleInput?.((line: string) => consolePanel.feedInput(line))
  }

  /**
   * 套用語系**偏好**——⚠️ 它與「目前實際的語系」是兩件事。
   *
   * 🔴 `follow-host` 是**一個值**，不是「沒有值」：使用者 2026-08-25
   * 拍板「跟宿主走，但是還是可以選」，而教學情境要的正是
   * 「介面英文、積木中文」——那在「只存結果」的模型裡表達不出來。
   */
  private async applyLocalePreference(preference: string): Promise<void> {
    // 🔴 **偏好與結果都要記**——只記結果的話，「跟隨宿主」在下一次
    //    重畫狀態列時就退化成一個固定值，而使用者不會發現。
    //
    // ⚠️ 而這裡曾經是**兩條路**：面板的下拉直接改 `currentLocale`，
    //    只有宿主那條會經過這裡。於是網頁版選了 English 之後，
    //    「使用者選的是什麼」這一格仍然停在 `zh-TW`。
    //
    // > **同一件事有兩個入口，而只有一個記得使用者的選擇——
    // > 那個沒記的，遲早會被當成真相。**
    this.localePreference = preference
    const effective = preference === FOLLOW_HOST_LOCALE ? this.resolvedHostLocale() : preference
    await this.localeLoader.load(effective)
    this.currentLocale = effective
    this.updateToolbox()
    this.syncBlocksToCodeWithMappings()
    this.refreshStatusBar()
  }

  /**
   * 宿主的顯示語言映射到我們支援的語系。
   *
   * ⚠️ 宿主給的是 BCP-47（`zh-tw` / `zh-cn` / `en-us`），而我們只有兩個
   * ——🔴 **對不上時回 `en`，不是回「現在這個」**：後者會讓
   * 「跟隨宿主」在宿主換語言時安靜地不動。
   */
  private resolvedHostLocale(): string {
    const raw = (this.hostLocale ?? '').toLowerCase()
    if (raw.startsWith('zh')) return 'zh-TW'
    return 'en'
  }

  /**
   * 程式碼那一側的視圖 id——**問登錄表，不寫死**。
   *
   * 🔴 網頁版是 `monaco-panel`，擴充是 `vscode-code-view`：寫死任何一個
   * 都會讓另一個宿主的來源顯示成錯的那一顆。
   */
  private codeViewId(): string {
    const blocks = this.blocklyPanel?.viewId
    return viewsWith('editable').map((v) => v.viewId).find((id) => id !== blocks) ?? 'monaco-panel'
  }

  /**
   * 接宿主下的同步指令（VSCode／Theia 的狀態列與命令面板）。
   *
   * 🔴 **同一個機制、兩個入口**——網頁版點自己的狀態列，擴充走宿主的。
   * 我一度以為擴充那側不必做，理由是「那裡真相是文件」——
   * **那只推得掉「誰是來源」那一格**（`core/sync-coordinator.ts` 的檔頭記著）。
   */
  private wireHostSyncCommands(): void {
    this.codeView?.onSyncCommand?.((cmd) => {
      if (cmd.action === 'pause') this.setSyncPaused(true)
      else if (cmd.action === 'resume') this.setSyncPaused(false)
      else if (cmd.viewId) this.useAsSource(cmd.viewId)
    })
  }

  private setupBidirectionalHighlight(): void {
    // Block → Code: unified via nodeId
    /**
     * **同一顆節點，在每一個視圖上一起亮。**
     *
     * 🔴 這條路以 `nodeId` 為鍵，早就在跑（積木 ↔ 程式碼）。
     * 2026-08-30 把**流程視圖**接進來——在此之前它的選取只有自己看得到。
     *
     * > **一個只有自己看得到的選取，在多視圖的編輯器裡等於沒有選。**
     *
     * ⚠️ `from` 是**來源視圖**：它自己不要再被通知一次，不然兩邊會互相
     * 通知到天亮。
     */
    /**
     * **「沒有選」不是一個要廣播的消息。**
     *
     * 🔴 使用者 2026-08-30：「積木發出的高亮好像無法傳到流程」，
     * 而他自己猜對了：「**切換到流程的 tab 會全部取消選取**」。
     *
     * 追出來的呼叫鏈逐字：
     *
     * ```
     * highlightNode(null)  ←  BlocklyPanel.onNodeSelectCallback
     * ```
     *
     * **點分頁按鈕就在工作區外面**，而 Blockly 對「點外面」的反應是取消選取
     * ——於是那個 `null` 一路清掉每一個視圖的反白。
     *
     * ⚠️ 第一版的修法是「看不見的視圖說的話不算數」，而**那不成立**：
     * 取消選取發生在 `display: none` **之前**，那一刻它還看得見。
     *
     * > **`null` 在那個事件裡有兩個意思：「使用者取消選取了」
     * > 與「焦點離開了這個視圖」——而它們長得一模一樣。**
     *
     * ## 🔴 這一格改了三次，而前兩次都是「在錯的地方分辨」
     *
     * ```
     * ① 看不見的視圖說的話不算數   ✗ 取消選取發生在 display:none 【之前】
     * ② null 只清發話者自己那一側   ✗ 發話者正是積木——切回去就沒了
     *                                （使用者：「切回積木，就沒了」）
     * ③ 在【源頭】分辨              ✓ Blockly 自己分得出「點空白處」與「焦點離開」
     * ```
     *
     * > **一個含混的訊號，要在【發出它的地方】被分辨清楚；
     * > 在下游猜它是哪一種，每一次都會少掉一個情況。**
     *
     * 🟢 所以現在到得了這裡的 `null` **都是明確的**——見 `blockly-panel.ts`
     * 裡那段 `CLICK` ＋ `targetType: 'workspace'`。
     */
    const linkNode = (nodeId: string | null, reason: 'block-to-code' | 'code-to-block', from: 'blocks' | 'code' | 'flow'): void => {
      if (nodeId === null) {
        // 🟢 到得了這裡的 `null` **都是明確的**：積木那側只在「點了工作區空白處」
        //    才送 `null`（`CLICK` ＋ `targetType: 'workspace'`），
        //    焦點離開造成的那一種在**源頭**就被擋掉了。
        this.codeView?.clearHighlight()
        this.blocklyPanel?.clearHighlight()
        this.flowPanel?.highlightNode(null)
        return
      }
      this.codeView?.clearHighlight()
      this.blocklyPanel?.clearHighlight()
      if (from !== 'flow') this.flowPanel?.highlightNode(nodeId)
      this.blocklyPanel?.highlightByNodeId(nodeId, reason)
      const range = this.syncController?.codeRangeForNode(nodeId)
      if (range) this.codeView?.addHighlight(range.startLine + 1, range.endLine + 1, reason)
    }

    this.blocklyPanel?.onNodeSelect((nodeId) => linkNode(nodeId, 'block-to-code', 'blocks'))
    // 🔴 **流程視圖也是一個選得動的視圖**——它選了，另外兩邊要跟著亮
    this.flowPanel?.onNodeSelect((nodeId: string | null) => linkNode(nodeId, 'block-to-code', 'flow'))
    // Code → Block: unified via nodeId
    this.codeView?.onCursorChange((line: number) => {
      try { if (Blockly.getSelected()) Blockly.common.setSelected(null as unknown as Blockly.ISelectable) } catch { /* ignore */ }
      this.codeView?.dismissPendingHighlight()
      linkNode(this.syncController?.nodeIdForLine(line - 1) ?? null, 'code-to-block', 'code')
    })
  }

  /**
   * ⚠️ `version` 必須是 `CURRENT_VERSION`，不是寫死的數字。
   *
   * 這裡原本寫 `version: 1`。自動存檔沒事——`storage.save()` 會強制蓋成
   * `CURRENT_VERSION`。**而匯出繞過 `save()`**（`getExportState()` →
   * `exportToBlob()`），所以每一份匯出的 `.json` 都自稱 v1，
   * 匯入時被跑過**八次**它不需要的升級。
   *
   * 今天沒有壞，因為那八次在現有資料上是冪等的（實測樹逐字未變）。
   * 但那是**巧合不是保證**——116 正要加一個會改寫積木狀態的 v10 步驟，
   * 而一份自稱 v1 的檔案會走到它。
   *
   * > **一個欄位有兩個寫入點，其中一個是對的，症狀就只在另一條路上出現。**
   *
   * 2026-08-11 錄 v9 存檔樣本時發現：localStorage 裡是 9，匯出的檔是 1。
   */
  /**
   * side-car 還用得嗎——**快取的失效條件**（v11 起）。
   *
   * 🔴 `blocklyState` 不是第二份真相，是一份**快取**：它讓開檔又快又精確
   * （不必重 lift、座標原樣回來）。而快取要有失效條件，否則它就是第二份真相。
   *
   * > **對不上的時候，寧可重排版，也不要拿一份與程式碼不一致的積木。**
   *
   * ⚠️ 舊存檔（v10 升上來）的 `codeHash` 由遷移補上，所以這裡不需要「沒有就當有效」
   * 的寬鬆分支——**那種寬鬆會讓失效條件變成裝飾**。
   */
  private sideCarUsable(state: SavedState): boolean {
    if (!state.blocklyState || Object.keys(state.blocklyState).length === 0) return false
    if (state.codeHash === undefined) return false
    return state.codeHash === hashCode(state.code)
  }

  private buildSaveState(): SavedState {
    // 🔴 **`tree` 不再存**（v11）：它是從 `code` 導出的，而在此之前它被存了
    //    10 個世代、被遷移改寫 8 次，**而沒有任何還原路徑在讀它**。
    // ⚠️ `codeHash` 是 side-car 的失效條件——積木狀態與程式碼對不上時
    //    寧可重排版，也不要拿一份不一致的積木當第二份真相。
    const code = this.codeView?.getCode() ?? ''
    return { version: CURRENT_VERSION, codeHash: hashCode(code),
      blocklyState: this.blocklyPanel?.getState() ?? {}, code,
      // 🔴 **流程佈局存的是鑰匙不是 nodeId**——見 `SavedState.flowLayout`。
      //    ⚠️ 它與 `blocklyState` 同桶而**不吃 `codeHash`**：
      //    失效條件內建在配對裡（對不上就退回自動排版）。
      flowLayout: this.flowPanel?.saveLayout() ?? [],
      language: this.currentTopic.language, styleId: this.currentStylePreset.id,
      topicId: this.currentTopic.id, targetId: this.currentTarget.id, enabledBranches: [...this.enabledBranches],
      lastModified: new Date().toISOString(), blockStyleId: this.currentBlockStyleId, locale: this.currentLocale }
  }

  private autoSave(): void {
    this.storageService.save(this.buildSaveState())
  }

  private restoreState(): void {
    const outcome = this.storageService.loadOutcome()

    // 「沒有存檔」與「存檔被拒絕」必須分開。混在一起的話，使用者會以為這是
    // 新的一頁，動一下就觸發自動存檔，把載不進來的那份蓋掉。
    // 見 specs/052-storage-integrity-gate/research.md F3
    if (outcome.kind === 'refused') {
      showToast(describeRefusal(outcome), 'warning')
      return
    }
    if (outcome.kind === 'empty') return

    const state = outcome.state

    // 1. Restore blocks FIRST (before level change triggers resync)
    //
    // 🔴 **快取對不上就走另一條路**（v11，2026-08-24）。
    //
    // ⚠️ 在此之前這個還原路徑**從來沒有用過 `state.code`**——步驟 3 是
    //    「從積木產生程式碼」，於是存檔裡那份程式碼只是輸出，不是輸入。
    //    那正是 `view-state.ts:5` 記的那句話：「網頁版沒有檔案 ⟹
    //    **積木的擺放【就是】真相**」。
    //
    // 🔴 而它讓「不用快取」變成一件危險的事：積木沒還原 → 工作區是空的
    //    → 步驟 3 從空工作區產生程式碼 → **把使用者的程式蓋成一個空骨架**。
    //    （2026-08-24 用真的 v9 存檔實測到，413 字的程式當場消失。）
    //
    // > **一個「從投影重建真相」的還原路徑，在投影缺席時會把真相抹掉。**
    // 🔴 **佈局先掛上去，而不是等同步完再放**——面板會自己等到有節點才套。
    //    ⚠️ 在這裡「等同步完成」等於要組裝點知道同步什麼時候結束，
    //    而那是一個它不該知道的東西。
    // 🟢 它**不受 `sideCarUsable` 管**：那道閘守的是積木快取（對不上會變成
    //    第二份真相），而佈局對不上只會退回自動排版——**兩者的最壞情況不同**。
    this.flowPanel?.restoreLayout(state.flowLayout ?? [])
    const useSideCar = this.sideCarUsable(state)
    if (useSideCar) {
      this.blocklyPanel?.setState(state.blocklyState)
    } else if (state.code) {
      // 程式碼才是真相——先把它放回去，積木在步驟 3 從它重建
      this.codeView?.setCode(state.code)
    }

    // 2. Restore topic and branches WITHOUT triggering resyncAfterTopicChange
    this._restoringState = true
    // ⚠️ `targetId` 優先，回退到 `topicId`——舊存檔（spec 136 之前）只有後者。
    // 🔴 而**認不得的 ID 一律回退到預設**，不得崩潰或留下一片空白。
    const savedTarget = state.targetId ? this.targetRegistry.get(state.targetId) : undefined
    if (savedTarget) this.currentTarget = savedTarget
    // ⚠️ 還原也要跟著換外殼——否則存檔存的是 Arduino，開起來卻套 `main()`。
    this.scaffold?.setSkeleton?.(this.currentTarget.skeleton ?? 'main')
    const topicId = savedTarget?.topic ?? state.topicId
    if (topicId) {
      const topic = this.topicRegistry.get(topicId)
      if (topic) {
        this.currentTopic = topic
        // 🔴 **還原也要切辨識用的文法**（spec 167）。
        //
        // ⚠️ 這條路**刻意不走 `handleTargetChange`**（註解就在上面幾行：
        // 「WITHOUT triggering resyncAfterTopicChange」），於是每一個
        // 「切目標時要做的事」都必須在這裡**再寫一次**——而漏掉的那些不會報錯。
        //
        // 症狀：存檔存的是 Python，重開之後 lifter 停在 C++ 的文法上，
        // **每一個節點都不匹配 → 整棵樹 `unresolved` → 畫面一片空白**。
        //
        // > **一條「只在還原時走」的路，會安靜地漏掉每一件在另一條路上做的事。**
        this.setActiveGrammar?.(topic.language)
        this.enabledBranches = state.enabledBranches
          ? new Set(state.enabledBranches)
          : new Set([topic.levelTree.id])
      }
    }
    // 舊存檔沒有 `targetId`，而它的 `styleId` 仍然照舊生效（下面既有的還原路徑）。
    if (savedTarget) {
      const style = STYLE_PRESETS.find(p => p.id === savedTarget.style)
      if (style && style.id !== this.currentStylePreset.id) this.applyStylePreset(style)
    }
    setScaffoldConfig({ scaffoldDepth: this.getScaffoldDepth() })
    this.syncController?.setTopic(this.currentTopic, this.enabledBranches)
    this.syncController?.setScaffoldDepth(this.scaffoldDepth)
    this.updateToolbox()
    this._restoringState = false

    // 3. Generate code from restored blocks, then resync for the restored topic
    //
    // ⚠️ **第一個呼叫在這個時點必然空轉**：積木剛 `setState` 進來，而匯流排
    //    還沒畫過它（`staleReason === 'not-rendered'`），於是它會擋下寫回。
    //    真正把程式碼生出來的是下面那一行。
    //    🔴 留著它是因為「擋下寫回」本身是對的；而在 2026-08-24 之前它會
    //    **每一次重新整理都彈一條紅色的錯誤訊息**——使用者：「我覺得這會讓
    //    使用者有誤會，以為剛開啟的時候系統錯誤。」
    if (useSideCar) {
      this.syncBlocksToCodeWithMappings()
      this.resyncAfterTopicChange()
    } else if (state.code) {
      // 🔴 **方向要反過來，而順序也要反過來**（2026-08-24 實測兩次才對）。
      //
      // 快取失效時是程式碼餵積木，不是積木餵程式碼。而光是換方向還不夠——
      // `resyncAfterTopicChange()` 自己會**從積木重新產生程式碼**，於是它會
      // 在最後一刻把還原好的程式碼蓋成一個空骨架。
      //
      // > **在這條路上，最後一個寫程式碼的必須是真相本身。**
      this.resyncAfterTopicChange()
      this.codeView?.setCode(state.code)
      this.syncController?.syncCodeToBlocks(state.code)
    } else {
      this.resyncAfterTopicChange()
    }
  }

  private updateSyncHints(): void {
    document.getElementById('sync-blocks-btn')?.classList.toggle('sync-hint', this.blocksDirty)
    document.getElementById('sync-code-btn')?.classList.toggle('sync-hint', this.codeDirty)
  }

  private scheduleCodeToBlocksSync(): void {
    if (this.codeToBlocksTimer) clearTimeout(this.codeToBlocksTimer)
    this.codeToBlocksTimer = setTimeout(() => {
      this.codeToBlocksTimer = null
      this.syncController?.syncCodeToBlocks(this.codeView?.getCode())
    }, 800)
  }

  /**
   * 同步的選單——**一個入口，N 個來源**。
   *
   * 🔴 清單由 `viewsWith('editable')` 導出（第六十二條護欄盯著）：
   * 加第三個可編輯視圖時**這裡一個字都不用改**。
   */
  private openSyncMenu(): void {
    const snap = this.syncCoordinator.snapshot()
    const label = (viewId: string): string => msg(`SYNC_SOURCE_${viewId.replace(/-/g, '_').toUpperCase()}`, viewId)
    const options: { text: string; run: () => void }[] = []
    options.push(
      snap.phase === 'paused'
        ? { text: msg('SYNC_RESUME', '▶ 恢復自動同步'), run: () => this.setSyncPaused(false) }
        : { text: msg('SYNC_PAUSE', '⏸ 暫停自動同步'), run: () => this.setSyncPaused(true) },
    )
    for (const viewId of snap.candidates) {
      options.push({ text: `⟳ ${msg('SYNC_USE_AS_SOURCE', '以此為準')}：${label(viewId)}`, run: () => this.useAsSource(viewId) })
    }
    // 🔴 **走 QuickPick，與狀態列上其餘那幾顆同一個機制**（2026-08-25）。
    //
    // ⚠️ 一度它是置中的對話框、而 picker 是 QuickPick——同一條狀態列上
    // 兩顆按鈕、兩種選單。使用者：「選單也是學 IDE」。
    //
    // > **同一條列上的東西按起來要是同一件事；
    // > 兩種選單會讓人以為它們是兩種東西。**
    showQuickPick(
      {
        title: snap.phase === 'diverged'
          ? msg('SYNC_DIVERGED_ASK', '兩邊都改過了——要以哪一邊為準？')
          : msg('SYNC_MENU_TITLE', '同步'),
        items: options.map((o, i) => ({ value: String(i), label: o.text })),
      },
      (values) => {
        if (values === null) return
        options[Number(values[0])]?.run()
      },
    )
  }

  /** 🔴 選定來源＝把那一邊寫進真實，其餘重建 */
  private useAsSource(viewId: string): void {
    this.syncCoordinator.resolve(viewId)
    if (viewId === this.blocklyPanel?.viewId) {
      // 🔴 **使用者明確選了來源，寫不回去就必須出聲**（2026-08-25 實測抓到）。
      //
      // 同一個殘態守衛有兩個呼叫者，而「不出聲」只對其中一個是對的：
      // 開機時自動寫回不出聲是對的（正常過渡）；
      // **而使用者按了一個按鈕卻什麼都沒發生，他會以為程式壞了。**
      //
      // > **同一個守衛、兩個呼叫者——沉默只對其中一個是正確的。**
      if (this.blocklyPanel?.isStateStale) {
        showToast('積木還沒被畫過，這一次不能以它為準——請先讓它顯示出來', 'warning')
        return
      }
      this.syncBlocksToCodeWithMappings()
      this.blocksDirty = false
    } else {
      this.syncController?.syncCodeToBlocks(this.codeView?.getCode())
      this.codeDirty = false
    }
    this.updateSyncHints()
    this.refreshStatusBar()
  }

  private setSyncPaused(paused: boolean): void {
    if (paused) this.syncCoordinator.pause()
    else this.syncCoordinator.resume()
    this.autoSync = !paused
    this.updateSyncHints()
    this.refreshStatusBar()
    if (!paused) this.applyResumeSync()
  }

  /**
   * 🔴 **恢復時不自己挑來源**（2026-08-25）。
   *
   * 舊的 `toggleAutoSync` 在恢復時**把兩邊都同步一次**——而「兩邊都髒」正是
   * 分岔，它等於安靜地讓後跑的那一邊贏。
   *
   * > **有暫停，就一定要有手動來源；而分岔之後系統該【問】，不該【推】。**
   */
  private applyResumeSync(): void {
    if (this.syncCoordinator.snapshot().phase === 'diverged') {
      this.openSyncMenu()
      return
    }
    if (this.blocksDirty) {
      this.syncBlocksToCodeWithMappings()
      this.blocksDirty = false; this.updateSyncHints()
    }
    if (this.codeDirty) this.syncController?.syncCodeToBlocks(this.codeView?.getCode())
  }

  /**
   * 跑診斷並**廣播**。
   *
   * ## 🔴 廣播，不是命令（2026-08-14 換的）
   *
   * 這裡原本直接 `block.setWarningText(...)`——**執行端知道每個視圖該畫什麼**，
   * 而那正是 `execution:at-node` 那次收攏掉的東西（`history/051`）。
   * 現在它只說「診斷變了」，各視圖自己決定怎麼呈現。
   *
   * ⚠️ **空陣列也要廣播**：那是「沒有問題」，不是「沒有跑」——
   * 不廣播的話舊的波浪與警告不會被清掉。
   */
  /**
   * **兩個產出端，一次廣播。**
   *
   * ```
   * 規則吃積木   空插槽、欄位值           source: 'component'
   * 樹的性質     語法錯誤（少分號等）      source: 'parser'
   * ```
   *
   * 🔴 **不可以分兩次廣播**：`setModelMarkers` 與 `setWarningText(null)` 的語義
   * 都是**全集取代**——第二次會把第一次清掉。
   */
  private runAllDiagnostics(): void {
    const workspace = this.blocklyPanel?.getWorkspace()
    if (!workspace) return
    const allBlocks = workspace.getAllBlocks(false)

    // blockId → nodeId。**規則吃積木，而錨點是語義的**——轉換在這裡。
    const toNodeId = this.syncController?.getBlockIdToNodeIdMap() ?? new Map<string, string>()

    const adapt = (block: Blockly.Block): DiagnosticBlock => ({
      id: block.id, type: block.type,
      // ⚠️ 查不到對映時**退回 blockId**：那顆積木還沒被抽成語義節點
      // （剛拖出來、還沒同步）。用 blockId 當錨點的話積木視圖仍找得到它，
      // 而程式碼視圖找不到——**那是誠實的：那顆積木在程式碼裡本來就還不存在。**
      nodeId: toNodeId.get(block.id) ?? block.id,
      getFieldValue: (n: string) => block.getFieldValue(n),
      getInputTargetBlock: (n: string) => {
        const t = block.getInputTargetBlock(n)
        return t ? { id: t.id, nodeId: toNodeId.get(t.id) ?? t.id, type: t.type, getFieldValue: (x: string) => t.getFieldValue(x), getInputTargetBlock: () => null, getInput: (x: string) => t.getInput(x) } : null
      },
      getInput: (n: string) => block.getInput(n),
    })

    const diagnostics = [
      // 🟢 **2026-08-26：診斷規則跟著【目前這個語言】走**——在此之前寫死 C++ 那份，
      //    於是切到別的語言時跑的仍然是 C++ 的規則。
      ...runDiagnostics(allBlocks.map(adapt),
        (languagePack(this.currentTopic.language)?.diagnosticRules ?? []) as never),
      ...(this.currentTree ? diagnosticsFromTree(this.currentTree) : []),
    ]
    for (const v of registeredViews()) v.onDiagnostics?.({ diagnostics })
  }

  dispose(): void {
    this.blocklyPanel?.dispose()
    this.codeView?.dispose()
    this.executionController?.dispose()
  }
}
