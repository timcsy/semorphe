import { TAB_LAYERS } from './layout/mobile-tab-bar'
import * as Blockly from 'blockly'
import type { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { HostProfile } from '../core/host/host-profile'
import { consoleRole, BOTTOM_PAGES, bottomToggleValue, bottomPageOf, type BottomPage } from '../core/host/console-surface'
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
import { isAlwaysInScope, alwaysInScopeComponents, componentTraits } from '../core/component/traits'
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
import { LAYOUT_PRESETS, layoutPreset, hostLayoutOptions, type LayoutPresetId, type HostLayoutOption } from '../core/host/layout-presets'
import { SyncCoordinator } from '../core/sync-coordinator'
import { viewsWith } from '../core/view-registry'
import { installDialogs } from './prompt-dialog'
import type { StylePreset } from '../core/types'
import { CATEGORY_COLORS } from '../core/category-colors'
import { registerViewsIn, connectViews } from '../core/view-registry'
import { buildToolbox } from '../core/toolbox-builder'
import { lessonIdFromQuery, lessonDocHref, compareOutput, controlsPinnedBy, trackOf, scaffoldDepthOf, taskById, FREE_PRACTICE, type Lesson, type LessonTask, type ScaffoldMode } from '../core/lesson'
import type { LessonView } from '../core/semantic-wave'
import { markTaskPassed, isTaskPassed, passedCount, clearProgress, setProgressStore } from '../core/progress'
/**
 * 「題目」那顆 picker 裡**不是一個題目**的那一項。
 *
 * 🔴 前綴／哨兵值是這個專案的既有形狀（`doc:`／`skeleton:`／`mode:`）：
 * 一顆 picker 裡混著「選一個值」與「做一件事」時，用值本身分開它們。
 * ⚠️ 它不得與任何題目 id 相同——`parseTasks` 擋掉了空字串，而這一個帶冒號。
 */
const CLEAR_PROGRESS = 'action:clear-progress'
import { iterationCounts, loopRatio, loopNodeById } from '../core/iterations'
import { predictionFor, programSignature, type PredictQuestion } from '../core/predict'
import { scatterOrder } from '../core/arrange'
import { skeletonById, skeletonsOfLanguage, canHideScaffold } from '../core/skeleton'
// 🔴 「哪幾顆是骨架」的判定**住在 core**——流程視圖也問同一支（`history/188`）
import { unwrapSkeletonFrame, scaffoldComponentIds as coreScaffoldComponentIds } from '../core/scaffold-nodes'
import { lessonById, allTracks, lessonsOfTrack, solutionFor } from '../core/load-lessons'
import { allTemplates, templateById } from '../core/load-templates'
import { registeredViews } from '../core/view-registry'
import { BlockRegistrar } from './block-registrar'
import { createAppLayout, setupToolbarButtons, setupFileButtons, updateStatusBar } from './app-shell'
import { GITHUB_MARK, type AppShellElements, type AppShellCallbacks } from './app-shell'
import { renderStatusControls, openSettings, type MenuAction } from './layout/status-bar-controls'
import { openDrawer } from './layout/drawer'
import type { ConsolePanel } from './panels/console-panel'
import { showQuickPick } from './toolbar/quick-pick'
import { BlockStyleSelector } from './toolbar/block-style-selector'
import {} from '../core/component/traits'
import { ExecutionController } from './execution-controller'
// Semantic layer
// Projection layer
import { CURRENT_VERSION, hashCode } from '../core/storage-version'
import { diagNote } from '../core/diag-log'
import { createBrowserStore } from './browser-store'

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

  /**
   * **下方面板的開關**（2026-09-02，使用者要的）。
   *
   * 🔴 它與版面走**同一個選單**而**不是一張版面**：三張版面說的是「編輯區
   * 怎麼排」，而主控台是編輯區底下那條獨立的底條（spec 171）。
   *
   * ⚠️ 誰真的去開關它由 shell 決定：網頁版是自己那條底條，IDE 是**宿主的
   * panel 區**（那裡它根本不在這個 webview 裡）。
   */
  private toggleBottom?: (page: BottomPage) => void
  private bottomVisibility?: () => { console: boolean; variables: boolean }
  /** 🔴 宿主看不看得出那件事——看不出來時標籤要中性（見版面選單那一段）。 */
  private bottomVisibilityKnown?: () => boolean

  /** 這個宿主提供得出來的版面——由 shell 回答（只有它知道哪一層在不在）。 */
  private shellLayoutOptions?: () => readonly HostLayoutOption[]
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
   * **現在在做哪一題**——`FREE_PRACTICE`（空字串）＝ 純練習。
   *
   * 🔴 預設是**這一課的第一題**（「跟著做」），不是純練習——因為第一次打開
   * 一堂課時，學生要做的就是課文帶著他做的那一支，而 diff 會在他最需要的
   * 時候出現。使用者 2026-09-04 拍板：「預設是跟著做的那題」。
   *
   * ⚠️ 它與 `currentLesson` 一樣是 `session` 域的——**不進存檔**。
   *    換一堂課就重設（見 `applyLesson`）：留著上一課的題目 id
   *    會讓裁判對著一個不存在的題目沉默，而畫面上看不出為什麼。
   */
  private currentTaskId: string = FREE_PRACTICE
  /**
   * 這一次跑之前他猜了什麼（`undefined` ＝ 沒問或跳過）。
   * ⚠️ 它活得很短：問完到揭曉為止。
   */
  private pendingPrediction: { q: PredictQuestion; guess: string } | undefined
  /**
   * 上一次**問過預測**的那支程式。
   *
   * 🔴 預測只在「你還不知道答案」時有意義——跑過一次之後再問同一件事，
   * 那是儀式，而學生一眼看穿。所以只在**程式改過之後的第一次執行**問。
   */
  private lastPredictedProgram = ''
  /** 最近一次執行的節點次數——揭曉「跑幾次」要用。 */
  private lastCounts: ReadonlyMap<string, number> = new Map()
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
  /**
   * **同步進行中時來的那些改動**（2026-09-02）。
   *
   * 🔴 使用者：「為何我輸入完了底下卻還有紅線？明明已經對了」——而畫面上的
   * 積木停在**打到一半**的那個樣子（`宣告 cout 變數 return`）。
   *
   *    根因是 `codeView.onChange` 遇到「同步進行中」時**整個 return**：那一段
   *    時間（同步 ＋ 300ms 尾巴）內按的鍵**連記都沒記**。而最後一個鍵剛好落在
   *    那個窗口時，就沒有下一次同步來收拾它。
   *
   * > **一個「現在很忙，先不理」的守衛，如果不記得它忽略過什麼，
   * > 那些被忽略的東西就永遠不會再被處理。**
   *
   * ⚠️ 它會收斂：補相依那一次寫入也會設起這個旗標，而下一輪不再需要補，
   *    於是最多多跑一趟。
   */
  private _codeChangedWhileSyncing = false
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

  /**
   * ☰：動作那一張（課程／檔案）——與 ⚙ 的設定分開，而且**是一個抽屜**。
   *
   * 🔴 形狀不同是因為意圖不同（使用者 2026-09-03）：
   * 設定是「這一格選哪一個值」（QuickPick 選完就關），
   * 動作是「這裡有這些東西」（抽屜留在那裡）。
   */
  private openActionMenu(): void {
    openDrawer('選單', this.menuActions().map((a) => ({
      id: a.id, label: a.label, description: a.description, icon: a.icon,
      iconPath: a.iconPath, dividerBefore: a.dividerBefore, run: a.run,
    })))
  }

  /**
   * ☰ 選單上半段的**動作**——行動版把「檔案」與「課程」從標頭藏起來之後，
   * 它們的家在這裡。
   *
   * 🔴 **不重寫那三顆的行為，按同一顆按鈕**：匯出／匯入／上傳的實作住在
   * `app-shell` 的事件處理器裡，行動版只是把那顆 `<button>` 隱藏起來
   * ——它還在 DOM 裡。抄一份實作到這裡的話，兩份遲早會不一樣。
   *
   * > **要在第二個地方提供同一件事，最便宜的做法是【按同一顆按鈕】，
   * > 不是把它做第二次。**
   *
   * ⚠️ 閘門是 `fileButtons`：宿主自己管檔案時，這幾項不該存在
   *（IDE 裡我們的 `/lessons/` 也不存在——見 `app-shell` 的「課程」那一段）。
   *
   * 🪦 **「清除學習進度」曾經放在這裡，而那是錯的**（2026-09-04）：
   *    ☰ **只有行動版有**（`mobileLayout` ＋ `fileButtons`），
   *    而需要它的人——老師，在電腦教室裡，兩節課之間——坐在桌機前。
   *
   * > **一個入口如果只在某一種螢幕寬度下存在，
   * > 那它對「在另一種寬度下工作的那個人」等於不存在。**
   *
   *    它搬到「題目」那顆 picker 裡了（見 `controlStateOf` 的 `task`）
   *    ——**進度顯示在哪，清除就在哪**。
   */
  private menuActions(): MenuAction[] {
    if (!this.profile.features.fileButtons) return []
    const press = (id: string) => () => document.getElementById(id)?.click()
    const open = this.codeView?.openExternal
    return [
      ...(open ? [{
        id: 'lessons', label: '課程', icon: '📖', description: '66 堂課的課文（開新分頁）',
        run: () => open('/lessons/'),
      }] : []),
      { id: 'export', label: '匯出', icon: '⬇', description: '把目前的作品存成 .json 檔', run: press('export-btn') },
      { id: 'import', label: '匯入', icon: '⬆', description: '從 .json 檔載回來', run: press('import-btn') },
      { id: 'upload-blocks', label: '上傳自訂積木', icon: '🧩', run: press('upload-blocks-btn') },
      // 🔴 **GitHub 在抽屜的最下面，而它【不是】重複**（使用者 2026-09-03 拍板）。
      //
      //    我上一版把它拿掉了，理由是「同一件事兩個開關」。而那條規矩在這裡
      //    不成立：標頭那顆現在**只剩圖示、沒有標籤**（「Star」兩個字讓給了空間）。
      //
      // > **一個沒有標籤的圖示，需要一個地方把它的名字說出來
      // > ——那不是第二個開關，那是它的說明。**
      //
      // ⚠️ 它與上面那三項用分隔線隔開：上面是「對我的作品做什麼」，
      //    下面是「這個專案」。
      ...(open ? [{
        id: 'github', label: '在 GitHub 給星星', iconPath: { d: GITHUB_MARK, size: 16 },
        dividerBefore: true,
        description: 'github.com/timcsy/semorphe',
        run: () => open('https://github.com/timcsy/semorphe'),
      }] : []),
    ]
  }

  /**
   * **清除學習進度**——那些「✅ 你完成了」的勾。
   *
   * 🔴 **入口要明顯**：藏起來的清除鍵等於沒有，而需要它的人（老師，
   * 在電腦教室裡，兩節課之間）沒有時間找。
   *
   * ⚠️ 而它**要問一次**：那份紀錄是學生自己累積的，而這個動作救不回來。
   *    ——形狀與「換目標會清空檔案」那一顆一樣（`selectTarget` 的確認）。
   */
  private confirmClearProgress(): void {
    showQuickPick(
      {
        // ⚠️ QuickPick 的標題是**純文字**，寫 `**粗體**` 會原樣顯示成星號
        title: '清除學習進度？所有課的「已完成」都會不見，而且救不回來',
        items: [
          { value: 'yes', label: '清除（救不回來）' },
          { value: 'no', label: '取消' },
        ],
      },
      (v) => {
        if (v?.[0] !== 'yes') return
        clearProgress()
        // 🔴 **選單上那個「2/3」要當場歸零**——不重畫的話，
        //    畫面會顯示一份已經不存在的進度，而那比不清更糟。
        this.publishControls()
      },
    )
  }

  /** 這一次執行印出來的東西——⚠️ 只收 `stdout`，錯誤訊息不是「輸出」。 */
  private runTranscript = ''

  /**
   * **裁判**：跑完之後，把輸出與這一課要的比一比。
   *
   * ## 🔴 為什麼接在【組裝點】上
   *
   * 執行器不知道有「課程」這種東西（它只會跑一棵樹），而主控台不知道
   * 「現在是哪一課」。**只有組裝點兩邊都知道**——所以這條線在這裡接，
   * 不在那兩邊任何一邊。
   *
   * ## ⚠️ 它為什麼一直不存在
   *
   * `check.stdout` 從 2026-08 就寫在 66 份 `lesson.json` 裡，而
   * `Lesson` 型別裡**沒有 check** ——`parseLesson` 讀完就丟。
   * 也就是說**應用根本不知道它存在**，學生按了執行沒有人告訴他對了沒有。
   *
   * > **一個「東西早就在了、缺的只是出口」的形狀，這個專案是第二次遇到**
   * > （第一次是 13 萬字的課文，`history/205`）。
   *
   * ## 🪦 而「一課一判」活了兩天（2026-09-04）
   *
   * 使用者：「課程應該除了課程題目之外，還會有一些練習題，**這樣去比對結果
   * 不就沒有辦法做練習題了**？」——學生一做練習題，寫的就是另一支程式，
   * 而裁判會在他做對事情的時候說他錯。**那比沒有裁判更糟。**
   *
   * 現在判的是**目前釘住的那一題**（狀態列上的「題目」那一格），
   * 而「純練習」時它完全沉默。見 `judgeCurrentTask`。
   */
  private wireLessonCheck(consolePanel?: ConsolePanel): void {
    if (!consolePanel) return
    // ⚠️ 只累積 `stdout`：`stderr` 是「它壞了」，不是「它印了什麼」
    this.bus.on('execution:output', (e) => {
      if (e.stream !== 'stderr') this.runTranscript += e.text
    })
    this.bus.on('execution:state', (e) => {
      // 🔴 **每次開跑都要歸零**——不然第二次執行會把第一次的輸出算進去，
      //    而那個 bug 的樣子是「第一次對、第二次也對，第三次莫名其妙不對」
      if (e.status === 'running') {
        // 🔴 **`running` 送出來【不只一次】**（2026-09-04 抓到的）：
        //    每次程式停下來等輸入，執行器都會再送一次
        //    `{ status: 'running', reason: 'awaiting-input' }`。
        //
        //    而這裡原本無條件歸零 ⟹ **任何會讀輸入的課，裁判都只看得到
        //    「最後一次輸入之後」印的東西**，前面印的全部被丟掉。
        //
        //    症狀不是報錯：`那不是數字` 明明印在主控台上，而裁判說「還沒對，
        //    你少了那一行」——**裁判在對一個做對的學生說他錯**，
        //    正是這一整輪在拆的那件事。
        //
        // > **一個「開始」事件如果在中途也會送，那把它當成「開始」的每一段
        // > 邏輯都錯了——而它們錯得很安靜。**
        if (e.reason !== undefined) return
        this.runTranscript = ''
        // ⚠️ 上一次的覆蓋標記與次數標註，在這一次開跑時就過期了
        this.blocklyPanel?.clearNeverRan()
        this.blocklyPanel?.clearIterations()
        return
      }
      if (e.status !== 'completed') return
      // ⚠️ 預測在裁判**之前**——先「機器做的跟我想的不一樣」，再「這一題對了沒」
      this.revealPrediction(consolePanel)
      this.judgeCurrentTask(consolePanel)
    })

    // 🔴 **執行覆蓋**：跑完把沒被走到的積木標出來，並在主控台問一句。
    //
    //    初學者的 bug 有壓倒性的比例是「**這一段從來沒跑到**」：`return` 後面的
    //    程式碼、永遠不成立的 `if`、根本沒進去的迴圈。
    //
    // ⚠️ 而它是**問句不是判決**：一個 `if` 的另一支本來就可能不該跑。
    //    所以文案是「是故意的嗎」，而視覺是琥珀色虛線，不是紅色（見 CSS）。
    this.bus.on('execution:coverage', (e) => {
      // ⚠️ 留一份給揭曉用——`execution:coverage` 在 `completed` **之前**送達
      this.lastCounts = new Map(Object.entries(e.counts))
      const n = this.blocklyPanel?.markNeverRan(new Set(e.visited)) ?? 0
      if (n > 0) consolePanel.log(msg('COVERAGE_NEVER_RAN', `⚠️ 有 ${n} 塊積木這一次沒有被跑到——是故意的嗎？`)
        .replace('{n}', String(n)))
      // 🔴 **迴圈跑了幾次**——同一份資料的第二個問題（2026-09-04 第三刀）。
      //
      //    初學者的另一種 bug 是「跑的次數不對」（差一錯誤），而那是
      //    **看不見的**：程式跑完了、沒有錯誤、輸出少一行，而他只能一行一行讀。
      //
      // ⚠️ 主控台**不再說一次**：數字已經標在那顆迴圈上了，
      //    而重複說一遍會讓主控台變成一份沒有人讀的日誌。
      //    ⚠️ 樹要用**顯示樹**（學生看到的那一棵），不是內部樹——
      //    id 對不上的話一塊都標不出來，而畫面上與「這次沒有迴圈」一模一樣。
      this.blocklyPanel?.markIterations(
        iterationCounts(this.syncController?.getDisplayTree(), this.lastCounts),
      )
    })
  }

  /**
   * 跑完了——**該不該說話，以及對誰說**。
   *
   * ## 🔴 三種沉默，而它們的理由不同
   *
   * ```
   * 沒有課               「哪一題」這個問題不存在
   * 純練習               他【說了】他不在做題目 —— 而這是使用者 2026-09-04 給的那一格
   * 這一題沒有裁判       「改用 while 寫」的輸出一模一樣，判不了
   * ```
   *
   * ⚠️ 三種都**不能說「對了」**：一個永遠說對的勾會讓所有的勾都貶值。
   *
   * ## 🔴 而「沉默」與「說錯話」之間，選沉默
   *
   * 「沒有命中任何一題」有兩種完全不同的意思——他在做某一題而還沒對
   * （他要的是 diff），或他只是在亂試（他不要任何人跳出來說他錯）。
   * **而系統分不出這兩者**，所以由他釘的那一題決定要不要開口。
   */
  private judgeCurrentTask(consolePanel: ConsolePanel): void {
    const lesson = this.currentLesson
    const task = taskById(lesson, this.currentTaskId)
    if (!lesson || !task?.check) return
    const result = compareOutput(this.runTranscript, task.check.stdout)
    consolePanel.showVerdict(result, task.title)
    if (!result.passed) return

    markTaskPassed(lesson.id, task.id)
    // 🔴 **不自動切下一題**——自動切會讓他下一次執行突然被另一題評價，
    //    而他不會知道是什麼時候換的。給一顆按鈕，他按了才算。
    //
    // > **一個會自己改變「我現在在做什麼」的系統，
    // > 會讓使用者失去對回饋的信任——因為他不知道那句話在對誰說。**
    const next = lesson.tasks.find((t) => !isTaskPassed(lesson.id, t.id))
    if (next) {
      consolePanel.offerNextTask(next.title, () => {
        this.currentTaskId = next.id
        this.publishControls()
      })
    }
    this.publishControls()   // ⚠️ 選單上那個「2/3」要跟著動
  }

  /**
   * **跑之前先問一句**——而它是 `ExecutionController` 注入的鉤子。
   *
   * ## 🔴 三種不問，而理由與裁判那三種是同一組
   *
   * ```
   * 沒有課 / 純練習    他【說了】他不在做題目
   * 這支程式剛才問過    預測只在「你還不知道答案」時有意義
   * 問不出好問題        多顆迴圈（「哪一顆」有歧義）· 輸出超過三行（那是抄寫）
   * ```
   *
   * ⚠️ 這個方法**會等**——使用者按了送出或跳過才回。那是刻意的：
   * 「猜完才跑」是這件事全部的重點（他跑完就知道答案了，那時再猜沒有意義）。
   */
  private async askPrediction(consolePanel: ConsolePanel | undefined, tree: SemanticNode): Promise<void> {
    this.pendingPrediction = undefined
    if (!consolePanel) return
    const task = taskById(this.currentLesson, this.currentTaskId)
    if (!task) return

    // ⚠️ 用**要跑的那棵樹**算簽章，不是顯示樹——問的是「這支程式」。
    const sig = programSignature(tree)
    if (sig === this.lastPredictedProgram) return

    const q = predictionFor(tree, task)
    if (!q) return
    this.lastPredictedProgram = sig
    const guess = await consolePanel.askPrediction(q.kind, q.prompt, q.choices)
    // 🔴 跳過是**正當的**，不是失敗——不記、不提、不再問這一支
    if (guess === null) return
    this.pendingPrediction = { q, guess }
  }

  /**
   * **揭曉**——而它接在裁判旁邊，因為兩者都是「跑完之後說一句」。
   *
   * ⚠️ 順序：預測在裁判**之前**。他先看到「機器做的跟我想的不一樣」，
   * 再看到「這一題對了沒有」——反過來的話，第二句會把第一句蓋掉。
   */
  private revealPrediction(consolePanel: ConsolePanel): void {
    const p = this.pendingPrediction
    this.pendingPrediction = undefined
    if (!p) return

    if (p.q.kind === 'choice') {
      const picked = p.q.choices?.find((c) => c.text === p.guess)
      const right = picked?.correct === true
      // ⚠️ 揭曉時給的「實際」是**真的跑出來的那份**，不是宣告裡標了 correct 的那個
      //    ——學生的程式可能與課文不同，而那時該相信執行器。
      consolePanel.showPrediction(p.guess, this.runTranscript.trim(), right, right ? undefined : picked?.why)
      return
    }
    if (p.q.kind === 'output') {
      // 🟢 **用同一支 `compareOutput`**：它對空白的處置（行尾寬容、行首不寬容、
      //    最後的換行不決定對錯）在這裡一樣是對的，而寫第二份會慢慢地不一樣。
      const cmp = compareOutput(p.guess, this.runTranscript)
      consolePanel.showPrediction(p.guess.trim(), this.runTranscript.trim(), cmp.passed)
      return
    }
    // 跑幾次——⚠️ 用**沒有過濾**的那一支：`1` 與 `0` 都是正當的答案，
    //    而「我猜 5，實際只跑了 1 次」正是最值得看到的那一種。
    const node = p.q.nodeId === undefined
      ? undefined
      : loopNodeById(this.syncController?.getDisplayTree(), p.q.nodeId)
        ?? loopNodeById(this.syncController?.getCurrentTree(), p.q.nodeId)
    const actual = node ? loopRatio(node, this.lastCounts) : undefined
    if (actual === undefined) return   // ⚠️ 那顆迴圈整個沒被走到——沒有數字可以揭曉
    const guessed = Number.parseInt(p.guess.trim(), 10)
    consolePanel.showPrediction(
      Number.isNaN(guessed) ? p.guess.trim() : `${guessed} 次`,
      `${actual} 次`,
      guessed === actual,
    )
  }

  /** 切換 editor 區顯示哪一個投影（積木／流程）。 */
  private showProjection: ((which: 'blocks' | 'flow' | 'code') => void) | null = null

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
    // 🔴 **進度存在哪，由組裝點說**（2026-09-06，spec 173）。
    //
    //    `core/progress.ts` 是**函式式**的（不是類別），所以注入走一個
    //    模組層級的 setter 而不是建構子。它的預設是**記憶體**
    //    ——核心不知道有 `localStorage` 這種東西。
    //
    // ⚠️ **兩個宿主都設同一個**：webview 裡也有 `localStorage`，
    //    而進度是「使用者的東西」（`FIELD_OWNERSHIP` 的 `user` 桶）
    //    ——它跨檔案、跨宿主都該在。所以它不走 `HostProfile`：
    //    那張表宣告的是**宿主之間不一樣的東西**，而這一件兩邊一樣。
    //
    // 🔴 少了這一行，症狀是**進度記不住**，而它不會報錯
    //    ——`audit-store-wired` 那條護欄盯著這一行還在不在。
    setProgressStore(createBrowserStore())
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
    if (canHideScaffold(skeletonById(this.currentSkeletonId)) || this.scaffoldDepth !== 0) return
    this.scaffoldDepth = 1
    setScaffoldConfig({ scaffoldDepth: this.scaffoldDepth })
    this.syncController?.setScaffoldDepth(this.scaffoldDepth)
    // 🔴 **改了深度就要讓畫面跟上**（2026-09-02）。
    //
    //    使用者：「說是**淡的**卻不是淡的」——狀態列已經寫著「淡的」，而積木
    //    上的骨架還是實心的。因為這一支只改了**數字**，而「淡」是重畫之後
    //    才蓋上去的一層（見 `setScaffoldMode`）。
    //
    // > **一個只改了狀態而沒有讓畫面跟上的修正，把一個「說謊的標籤」
    // > 換成了另一個——方向反過來而已。**
    //
    // ⚠️ **只重蓋鷹架那一層，不要順手重算「超出範圍」**（2026-09-02 實測）。
    //
    //    第一版這裡呼叫的是 `markOutOfScopeBlocks()`（它同時做兩件事），而這一支
    //    是在**換目標的途中**跑的——那時「這個主題看得到哪些元件」還沒算完，
    //    於是整個畫布被判成超出範圍，**每一顆積木都變淡**（使用者：
    //    「怎麼裡面的非骨架積木也淡了」）。
    //
    // > **一支「順手把兩件事一起做」的方法，在只需要其中一件的地方
    // > 會把另一件在錯的時機做掉。**
    setTimeout(() => this.remarkScaffold(), 900)
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

  /**
   * **換一份骨架——會把這個檔案清空，所以先問一句。**
   *
   * 🔴 它從哪來（2026-08-31）：使用者逐字——「換骨架就要跳出警告，
   * 並且說要把這檔案所有內容都清除」。
   *
   * 在此之前它只換 id，於是舊骨架的 `int main() { … }` 原封不動留在樹裡、
   * 新骨架又補上自己的框——**兩個框疊在一起**，而且沒有人被問過。
   *
   * ⚠️ **「有沒有東西」要扣掉現在那份骨架自己**（`unwrapSkeletonFrame`）：
   * 不扣的話，一支空的 `int main(){ return 0; }` 也算「有作品」，
   * 於是**每一次換骨架都會被問**，而那時清掉的其實什麼都不是。
   *
   * > **一句「你的東西會不見」的警告，在其實沒有東西的時候，
   * > 教會使用者的是「這個問句可以無視」。**
   *
   * 🟢 形狀抄 `applyTemplate`——同一個決定（會蓋掉畫布）不該有第二種問法。
   */
  private setSkeleton(id: string): void {
    const next = skeletonById(id)
    if (!next) { console.error(`[skeleton] 選了一份不存在的骨架：${id}`); return }
    if (id === this.currentSkeletonId) return

    const tree = this.syncController?.getCurrentTree()
    const rest = tree
      ? (unwrapSkeletonFrame(tree, this.currentSkeletonId) as SemanticNode)
      : undefined
    const hasWork = (rest?.children?.body ?? []).length > 0

    const go = async (): Promise<void> => {
      // 🔴 **三個持有者一起換**（鷹架、補丁器、同步器）——見 `adoptSkeleton`
      this.adoptSkeleton(id)
      this.enforceShellDepthFloor()
      this.updateToolbox()
      if (!tree) { this.reprojectFromTree(); this.publishControls(); return }
      // ① 清空：本體歸零，新骨架的框由產生器補上。
      // ⚠️ 沿用原本那顆根節點——`cpp:program` 這種身分不該出現在視圖層（P9）。
      // ⚠️ `relift: false`——那條補救路徑會回去讀**還帶著舊框**的程式碼。
      await this.syncController?.resyncForTopic(
        { ...tree, children: { ...tree.children, body: [] } }, '', false)
      // ② 再從**剛產生的程式碼**抬回樹裡。
      //
      // 🔴 少了這一步，「淡的」模式下畫布會**空無一物**（2026-08-31 使用者：
      //    「淡的骨架怎麼直接消失？」）——因為**骨架只活在產生出來的程式碼裡，
      //    樹裡沒有它**，而積木是樹的投影。
      //
      // > **一個只存在於某一個投影裡的東西，在別的投影上不是「淡的」，是沒有。**
      const fresh = this.codeView?.getCode?.() ?? ''
      if (fresh.trim() !== '') await this.syncController?.syncCodeToBlocks(fresh)
      // ③ 重新蓋上「哪幾塊是骨架」那一層視覺。
      //
      // 🔴 少了這一步，換完骨架的畫布上**一塊都不是淡的**（2026-08-31 使用者：
      //    「Arduino 淡的好像不是淡的」）——而把顯示模式切走再切回來就會對，
      //    因為那條路徑會經過 `markOutOfScopeBlocks`。
      //
      // > **一個「畫完之後蓋上去」的視覺層，每一條會重畫的路徑都要記得蓋。
      // > 而漏掉的那一條不會報錯——它只是少了一層。**
      //
      // ⚠️ `await` 回來時**積木還沒畫完**（重畫走匯流排，比這裡晚）——
      //    直接呼叫的話標記會蓋在還不存在的積木上，實測 ghost 是 0。
      //    這個 900ms 與 `setScaffoldMode` 那一句是**同一個理由、同一個數字**。
      setTimeout(() => this.markOutOfScopeBlocks(), 900)
      this.publishControls()
    }

    if (!hasWork) { void go(); return }
    showQuickPick(
      {
        // ⚠️ QuickPick 的標題是**純文字**——寫 `**粗體**` 會原樣顯示成星號
        title: `換成「${next.name}」？這個檔案的所有內容都會被清除`,
        items: [
          { value: 'yes', label: '換（這個檔案的所有內容會被清除）' },
          { value: 'no', label: '取消' },
        ],
      },
      (v) => { if (v?.[0] === 'yes') void go() },
    )
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
   * **套用這一題建議的看法**——⚠️ **一次，而且只有一次**。
   *
   * ## 🔴 「一次」就是「這不是閘門」的全部
   *
   * 學習者控制的整合分析（`concepts/認知鷹架.md`）：
   *
   * > **「sequence control is the only type that generally does not harm」**
   * > ——順序的控制權是唯一一種一般不會有害的。
   *
   * 所以系統給預設是對的，而**搶回去是錯的**。而「搶回去」在程式碼裡長成什麼樣？
   * 它不是一個 `if (locked)`——它是**在每一次重畫時再套用一次**。
   *
   * > **一個鎖，多數時候不是寫成鎖的。
   * > 它是一段「每次都重新套用預設值」的程式碼。**
   *
   * ⚠️ 所以這一支只從**換題**那一條路呼叫，不從任何重畫、同步或狀態發布的路徑。
   *
   * ## ⚠️ 而宿主做不到就跳過，不要退而求其次
   *
   * VSCode 的面板裡只有積木與流程兩層（程式碼在 IDE 自己的編輯器）。
   * 那裡「專注程式碼」沒有意義——**跳過比擺一個最接近的更好**，
   * 因為後者會讓學生看到一個他沒有要的版面而不知道為什麼。
   */
  private applySuggestedView(view: LessonView | undefined): void {
    if (view === undefined) return
    const layout: LayoutPresetId =
      view === 'compare' ? 'compare' : view === 'three' ? 'three-column' : 'focus'
    // 🔴 **專注時一定要說「專注哪一層」**——三種都要說，`code` 也要。
    //    ⚠️ 少了 `code` 那一支，從「排回去」（積木）切到下一題（程式碼）時
    //    版面會換成專注**而那一格還是積木**：課程說了 code，學生看到積木。
    if (view === 'blocks' || view === 'flow' || view === 'code') this.showProjection?.(view)
    this.applyLayout?.(layout)
    // 🔴 **`currentLayout` 也要跟著動**——它是狀態列那顆算標籤用的那一格。
    //    只呼叫 `applyLayout` 的話：版面真的換了（`gridTemplateAreas` 變了），
    //    **而標籤還寫著舊的**——那比沒換更糟，因為畫面上兩個地方互相打臉。
    //
    // > **一個「做了那件事」的呼叫，與一個「記得那件事做過了」的欄位，
    // > 是兩件事——而少了後者，畫面會開始說謊。**
    this.currentLayout = layout
    // ⚠️ 套用完要再發布一次：標籤是從現況算的，而呼叫端多半在套用【之前】發布過。
    this.publishControls()
  }

  /**
   * **鋪一題「排回去」**（文獻裡叫 Parsons problem）——把參考解答的積木打散在畫布上。
   *
   * ## 🔴 為什麼幾乎不用寫東西
   *
   * 這一題要的每一塊零件都已經在：
   *
   * ```
   * 解答      solutions/<題目 id>.<副檔名>（42 題已經有，而且每一份都真的跑過）
   * 變積木    syncCodeToBlocks —— 就是「以此為準：程式碼」那條路
   * 打散      core/arrange.ts 的 scatterOrder（確定性）
   * 判對錯    既有的裁判：排完按執行，比對輸出
   * ```
   *
   * > **一個為了教學而發明的載體（打散的卡片），
   * > 在這裡本來就是產品的主體。**
   *
   * ## ⚠️ 打散的是【語句】，不是每一塊積木
   *
   * 把 `cout << n << endl;` 拆成三塊（輸出／變數／換行）不是 Parsons 題，
   * 是拼圖——而學生要練的是**順序與結構**，不是把運算式重組回去。
   *
   * 🔴 同一條規矩在「執行覆蓋」那一刀已經定過一次：
   * **回饋的計數單位要跟使用者的知覺一致**，而學生眼裡一行就是一塊。
   *
   * ## ⚠️ 而它會蓋掉畫布——所以先問一句
   *
   * 形狀與「套用範例」一樣（`applyTemplate`）：選了一題卻沒看到它，
   * 比被問一句更糟；而**吃掉他寫到一半的東西**比兩者都糟。
   */
  private async seedArrange(lesson: Lesson, task: LessonTask): Promise<void> {
    const code = solutionFor(lesson.id, task.id)
    if (code === undefined) {
      // 🔴 **出聲**——一個安靜地變成「自己寫」的 Parsons 題，
      //    畫面上與「這一課還沒寫好」一模一樣。
      console.error(`[arrange] ${lesson.id}#${task.id} 宣告了 arrange 而沒有 solutions/ 檔`)
      return
    }
    await this.syncController?.syncCodeToBlocks(code)
    // 🔴 **等鷹架標記填好，而不是等一個猜出來的毫秒數。**
    //
    //    `lastScaffoldIds` 是同步之後才填的，而「哪幾塊是他不該搬的」
    //    （`return 0;`）要靠它。等固定秒數的話，機器快一點的那天
    //    `return 0;` 會被一起打散——而那不會報錯，只會多一塊他碰不到的積木。
    //
    // > **一個「等別人做完」的等待，寫成毫秒數就是在賭那台機器的速度。**
    //
    // ⚠️ 有上限：鷹架剝光（`hidden`）的課本來就沒有鷹架積木，等不到是正常的。
    //
    // 🔴 **而「同步真的結束了」也要等**（2026-09-06，spec 172 實測抓到）。
    //
    //    `syncCodeToBlocks` 的 `await` 回來時 `_codeToBlocksInProgress`
    //    **還是 true**——它在稍後才清。而積木那側的變更處理器第一行就是
    //    `if (this._codeToBlocksInProgress) return`，於是 `scatter` 造成的
    //    19 次變更**一次都沒有寫回程式碼**：散落的積木在畫布上，
    //    而程式碼還是原來那一份。
    //
    //    ⚠️ 這個 bug 是被「骨架改走匯流排」**逼出來的，而不是它造成的**：
    //    在此之前骨架標記由組裝點在 `setTimeout(…, 900)` 裡做，
    //    於是這個迴圈**順便**等掉了那 900 毫秒。
    //
    // > **一個等 A 的迴圈，如果它真正需要的是 B，
    // > 那它在「A 變快了」的那一天會安靜地全部落空
    // > ——而在那之前，它一直在靠一個沒有人寫下來的巧合活著。**
    const ready = (): boolean =>
      this.blocklyPanel?.scaffoldMarked() === true && !this._codeToBlocksInProgress
    for (let i = 0; i < 30 && !ready(); i++) {
      await new Promise((r) => setTimeout(r, 100))
    }
    const n = this.blocklyPanel?.scatterTopStatements(
      scatterOrder(`${lesson.id}#${task.id}`, 64)) ?? 0
    if (n === 0) {
      console.error(`[arrange] ${lesson.id}#${task.id} 一塊都沒打散——那一題等於直接給答案`)
    }
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
        this.currentTaskId = FREE_PRACTICE
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
  /**
   * **去讀這一課的課文**——開靜態頁（`dist/lessons/<軌道>/<課>/`）。
   *
   * 🔴 網址由**同一支函式**產生（`core/lesson.ts` 的 `lessonDocHref`），
   * 不是在這裡拼一次字串——兩邊各拼一次的話，中文課名的 encode 遲早不一樣，
   * 而症狀是一個 404。
   *
   * ⚠️ `codeView.openExternal` 不存在時**這個選項根本不會被端出來**（見上面），
   * 所以這裡不必再處理「開不了」。
   */
  private openLessonDoc(id: string): void {
    this.codeView?.openExternal?.(lessonDocHref(id))
  }

  private selectLesson(id: string): void {
    const lesson = id === '' ? undefined : lessonById(id)
    if (id !== '' && !lesson) {
      console.error(`[lessons] 選了一堂不存在的課：${id}`)
      return
    }
    this.currentLesson = lesson
    this.currentTrack = lesson ? trackOf(lesson.id) : this.currentTrack
    // ⚠️ 沒有課 ⟹ 純練習。與 `applyLesson` 是同一條規矩的兩端。
    this.currentTaskId = lesson?.tasks[0]?.id ?? FREE_PRACTICE
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
    // 🔴 **重投影完再打一次暗**（2026-09-02）。
    //
    //    使用者選了「閃一顆燈」之後看到 `setup`／`loop` 整片是**紅的**
    //    （超出範圍）：「怎麼淡的怪怪的」。而它們是**工具自己放的骨架**，
    //    本來就該在範圍內。
    //
    //    根因是時機：「哪幾顆是骨架」問的是**目前那棵樹**
    //    （`scaffoldComponentIds()`），而換課會換目標、換骨架、重投影
    //    ——同步那一趟做完之前，那個集合是**上一棵樹**的答案，甚至是空的。
    //
    // > **一個「這顆在不在範圍內」的判斷，如果它問的是一棵還沒長好的樹，
    // > 它會把工具自己放的東西判成學生不該碰的東西。**
    this.remarkAfterSettled()
  }

  /**
   * **等重投影落地之後再打一次暗**。
   *
   * ⚠️ 900ms 是量出來的（與 `setScaffoldMode` 同一個數字）：`reprojectFromTree`
   * 是非同步的，而「超出範圍」與「鷹架」這兩層都蓋在**畫完之後**的積木上。
   */
  private remarkAfterSettled(): void {
    setTimeout(() => this.markOutOfScopeBlocks(), 900)
  }

  /**
   * 套用一堂課：釘住目標、收窄可見元件。
   *
   * ⚠️ 被釘住的控制項**消失**（`publishControls` 濾掉它），不是變灰
   * ——「這裡有一個你不能碰的東西」仍然是負擔，而且它在嘲笑你。
   */
  private applyLesson(lesson: Lesson): void {
    this.currentLesson = lesson
    // 🔴 **軌道也要跟著設**（2026-09-03）：`?lesson=` 那條路只設了「哪一課」，
    //    而「章節」那顆控制項是**看軌道決定畫不畫**的（見 `publishControls`：
    //    「章節」與「範例」佔同一格）。
    //
    //    症狀很具體：從課文的靜態頁按「在編輯器打開」進來的人，
    //    畫面上**沒有章節選單**——於是他既跳不到下一章，也回不去讀課文。
    //
    // > **一條深連結如果只設了「我是誰」而沒設「我從哪來」，
    // > 使用者就會落在一個【走不回去】的狀態。**
    this.currentTrack = trackOf(lesson.id)
    // 🔴 **換課就重設題目**（2026-09-04）——預設是第一題「跟著做」。
    //    留著上一課的題目 id 的話，`taskById` 查不到它，於是裁判**沉默**
    //    ——而「沉默」與「這一題沒有裁判」在畫面上長得一模一樣。
    this.currentTaskId = lesson.tasks[0]?.id ?? FREE_PRACTICE
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
    // 🔴 **把建構子裡那個決定【再交一次】**（2026-09-03）。
    //
    //    `?lesson=arduino/…` 在**建構子**裡就走了 `applyLesson` → `adoptSkeleton`，
    //    而那支要交給三個持有者：
    //
    //    ```
    //    this.currentSkeletonId = id          ← 建構子裡唯一交得出去的
    //    this.scaffold?.setSkeleton?.(id)     ← 那時它是 null（init 才生）
    //    this.syncController?.setSkeleton?.(id) ← 那時它是 null（就在這一行生）
    //    ```
    //
    //    症狀：狀態列寫著「Arduino 骨架・淡的」，而畫布與程式碼是
    //    `using namespace std; int main() { return 0; }`。
    //    🪦 2026-08-28 修過**同一個症狀**一次，而那次只補了「換 id」這一半
    //    ——`applyLesson` 裡那句「在此之前這裡漏了它」講的就是那一次。
    //
    // > **一個在建構子裡做的決定，交給了三個還不存在的持有者
    // > ——它會安靜地只生效三分之一，而那三分之一正好是【給人看的那一格】。**
    this.adoptSkeleton(this.currentSkeletonId)
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
      // 🔴 **命名空間風格要一起交下去**（2026-09-02）：`using namespace std;`
      //    是補丁器寫進程式碼的，而它要不要出現在積木上，看的是同一格風格。
      const includeNodes = (shaping.autoIncludeNodes as
        (t: never, ns: 'using' | 'explicit') => SemanticNode[])(
        tree as never, this.currentStylePreset.namespace_style)
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
    this.wireLessonCheck(elements.consolePanel)

    // 🔴 **診斷的第二個產出端在樹上，而樹只從匯流排來。**
    //
    // 語法錯誤（少一個分號）的資料標在語義節點上，而 `runDiagnostics` 吃積木
    // ——積木上看不出少了分號（tree-sitter 復原之後那顆積木是完整的）。
    //
    // ⚠️ 而這順帶補上一個既有缺口：診斷原本**只掛在 Blockly 的變更上**
    // （`wireBlocklyChangeHandler`），所以程式碼改動不會直接觸發診斷。
    // `e2e/diagnostics.spec.ts` 的檔頭記過「那是另一條線，今天沒有防線」。
    this.bus.on('semantic:update', (e) => {
      const same = e.tree !== undefined && e.tree === this.currentTree
      if (e.tree) this.currentTree = e.tree
      // 🔴 **樹沒換就不重算診斷**（2026-09-06，spec 172）。
      //
      //    ⚠️ 在此之前這裡無條件重算，而那在 2026-09-06 之前不痛不癢
      //    ——每一則 `semantic:update` 都代表樹真的變了。
      //    骨架告示的重發（`republishScaffold`）帶的是**同一棵樹**：
      //    診斷的輸入一個位元都沒動，而重算一次會**取代**掉現有的那批
      //    ——包括別人剛推進去的（實測：診斷的 e2e 紅在「程式碼側沒有波浪」，
      //    而積木側是好的，因為積木側的圖示不走同一條取代路徑）。
      //
      // > **一個「輸入沒變所以輸出一樣」的重算，不是沒有代價的
      // > ——它會把中間那段時間裡別人放進去的東西一起洗掉。**
      if (!same) this.runAllDiagnostics()
    })

    // 8. Setup code→blocks pipeline
    await this.setupCodeToBlocksPipeline()

    // 9. Wire panel change events
    this.wireBlocklyChangeHandler()
    this.wireHostSyncCommands()
    this.codeView.onChange(() => {
      // 🔴 記住**上一步在哪裡做的**——那一對按鈕靠它轉送（見 `lastEditor`）
      this.lastEditor = 'code'
      // ⚠️ **記下來再回頭做**——見 `_codeChangedWhileSyncing`。
      if (this._codeToBlocksInProgress) { this._codeChangedWhileSyncing = true; return }
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
        // 🔴 **跑之前先猜一下**（2026-09-04 第四刀）——見 `askPrediction`。
        beforeRun: (tree) => this.askPrediction(elements.consolePanel, tree),
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
      onOpenMenu: () => this.openActionMenu(),
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
    // 🔴 **宿主換掉這個視窗畫哪一層**（2026-09-02）——IDE 的槽下拉走這條路：
    //    欄位一格都不動，換的是這個 webview 的內容（使用者：「欄位數不變，
    //    但是裡面的內容置換，就像網頁版那樣的處理」）。
    this.codeView?.onSetLayer?.((l) => elements.setHostLayer(l as never))
    this.wireHostConsole(elements.consolePanel)
    // 🔴 變數也是一條資料流，判準與主控台同一條（見 `wireHostConsole`）：
    //    **畫的人不報回去，報的人不畫**——否則是一個回音圈。
    const varSpec = CONTROLS.find((c) => c.id === 'variables')
    const varsDrawnLocally = !!varSpec
      && consoleRole(surfaceOf(varSpec, this.profile.controlSurfaces)) === 'draw'
    if (varsDrawnLocally) {
      this.codeView?.onVariablesSnapshot?.((groups) =>
        elements.variablePanel?.updateWithScopes(groups as never))
    } else {
      elements.variablePanel?.onSnapshot((groups) => this.codeView?.reportVariables?.(groups))
    }
    // 🔴 **暫停中改一個變數 → 匯流排**（2026-08-26）。
    //    面板自己**不認識執行器**——P9：跨層通訊只走 Bus（`principles.md:177`）。
    elements.variablePanel?.onEditValue((name, value) =>
      this.bus.emit('execution:set-variable', { name, value }))
    // 🔴 **流程面板改了一格 → 匯流排**（2026-08-26，(b) 改欄位）。
    //    ⚠️ 走 `edit:tree` 這個**通用**事件，不是 `edit:flow`
    //    ——一個以視圖命名的事件，會逼下一個視圖也要一個自己的名字。
    this.applyLayout = elements.applyLayout
    this.toggleBottom = elements.toggleBottom
    this.bottomVisibility = elements.bottomVisibility
    this.bottomVisibilityKnown = elements.bottomVisibilityKnown
    // ⚠️ 宿主那側的可見性是**推過來的**——它變了，選單上的標籤要跟著改。
    elements.onBottomVisibilityChanged(() => this.publishControls())
    this.shellLayoutOptions = elements.layoutOptions
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
        if (!patched) return
        const linesDelta = patched.split('\n').length - code.split('\n').length
        this.codeView?.setCodePreserveCursor(patched, linesDelta)
        // 🪦 **這裡曾經「補完就再 lift 一次」**（2026-09-02，當天就退場）。
        //
        //    動機是對的：補進去的那幾行**樹裡沒有**，而 IDE 那側的回音守衛
        //    會擋掉下一次 lift（診斷逐字：「✍️ 套用寫入…首行『#include <iostream>』」
        //    後面緊接著「🔇 判成【回音】，不送」）。
        //
        //    而 `preflight:vscode` 當場抓到代價：**還原變成沒有作用**
        //    ——「積木 → 程式碼：宿主收下 1 筆」（本來 2 筆）。因為再 lift 一次
        //    ＝重載工作區 ＝ **把還原堆清掉**，而它會被我們自己的寫入回音觸發。
        //
        // > **為了讓兩邊一致而重建一次真相，代價是使用者按不動還原
        // > ——一個修法如果會清掉使用者的歷史，它就不是修法。**
        //
        // 🟢 真正的修法在**顯示樹增強器**（見上面 `setDisplayTreeEnhancer`）：
        //    補丁器往文字裡加什麼，增強器就往樹裡補同樣的節點。那一條路
        //    不重建工作區，也就不會動到還原堆。

      }).then(() => {
        this.codeDirty = false
        this.blocksDirty = false
        this.updateSyncHints()
        // 🔴 **重畫過的積木沒有那兩層視覺**（2026-09-02）。
        //
        //    使用者：「怎麼我選淡的，前面還好好的，後面就不是淡的了？」
        //    ——打了一行字之後，程式碼→積木重建了整棵樹，而「淡的」與
        //    「超出範圍」是**畫完之後蓋上去**的一層，新的積木身上沒有它。
        //
        // > **一層蓋在畫面上的標記，它的壽命只到下一次重畫
        // > ——所以它要跟著【重畫】走，不是跟著【設定改變】走。**
        //
        // ⚠️ 這裡是**程式碼 → 積木**唯一的匯流點（見這個 wrapper 的檔頭），
        //    所以補在這裡就夠，不必每個呼叫點各記一次。
        // 🔴 **而補相依會【再長出積木】**（2026-09-02）：`patchMissingDependencies`
        //    把 `#include <iostream>` 寫回程式碼，那顆積木是**這一輪之後**才出現的
        //    ——上面那一次蓋不到它。使用者：「引入函式庫和使用命名空間應該也要是淡的吧」。
        //
        // > **一個「畫完之後蓋上去」的動作，如果畫還沒完，它蓋的是上一張畫。**
        // 🪦 **這裡曾經【立刻】再蓋一次**（`markOutOfScopeBlocks()`），而 e2e 抓到代價：
        //    `ghost` 的三條拖曳測試全紅——拖走學生的積木之後，`return 0` 留在 main 外面。
        //
        //    根因：`markScaffoldBlocks` 會 `setDragStrategy`＋`setEditable(false)`，
        //    而這一刀落在**拖曳還在進行中**的積木身上——正在跑的那次拖曳握著舊的策略物件，
        //    於是「把鷹架摘出來、結束時接回去」的後半段接到了空氣。
        //
        // > **一層「畫完之後蓋上去」的視覺，如果蓋的時候畫還沒停，
        // > 它蓋到的是一隻正在動的手。**
        //
        // 🟢 留下面那一支就夠（900ms 之後）：重投影本來就是非同步的，
        //    立刻蓋那一次蓋的也是上一張畫。
        this.remarkAfterSettled()
        setTimeout(() => {
          this._codeToBlocksInProgress = false
          this.drainCodeChangedWhileSyncing()
        }, 300)
      }).catch((err: unknown) => {
        console.error('Parse error:', err)
        this._codeToBlocksInProgress = false
        this.drainCodeChangedWhileSyncing()
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
    // 🔴 **不是概念的那幾顆先補進來**（2026-09-02）——見 `alwaysInScopeComponents`。
    //    ⚠️ 沒有選課的時候範圍來自**層級樹**，而註解不一定被列在任何一層裡；
    //       使用者：「剛開 ArduinoIDE 的樣子，是不正常的」（註解是暗的），
    //       而選了課之後反而正常——因為那條路已經補過了。
    const base = new Set([
      ...getVisibleComponents(this.currentTopic, this.enabledBranches),
      ...alwaysInScopeComponents(),
    ])
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
    // 🔴 **不是概念的東西不受課程範圍管**（2026-09-02）——見 `isAlwaysInScope`。
    //    註解是第一個：它落在課程那張表外面，而那不代表學生不該碰它。
    return new Set([...base].filter((c) =>
      want.has(c) || isAlwaysInScope(c) || isScaffoldComponent(c) || this.scaffoldComponentIds().has(c)))
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

  // 🪦 **`scaffoldNodeIds()` 已於 2026-09-06 退場**（spec 172）。
  //
  //    組裝點不再算「哪幾顆是骨架」——那份判定跟著告示走匯流排，
  //    而算它的地方是 `SyncController.scaffoldNotice()`。
  //
  // ⚠️ 它帶走的那一條註解**沒有消失，它搬家了**：
  //    「問畫布上那一棵」（自動補的 `#include`／`using namespace std;`
  //    只存在於顯示樹上）——那一行今天住在 `scaffoldNotice()` 裡。
  //
  // > **一支函式退場的時候，它註解裡那個【踩過的雷】要跟著搬到新家，
  // > 不然下一個人會在新家再踩一次。**

  /**
   * **把「忙的時候被忽略的那些改動」補做一次**（見 `_codeChangedWhileSyncing`）。
   *
   * ⚠️ 只補**一次**排程，不是每一筆各排一次——它們的結果都是「拿現在的程式碼再同步一次」。
   */
  private drainCodeChangedWhileSyncing(): void {
    if (!this._codeChangedWhileSyncing) return
    this._codeChangedWhileSyncing = false
    this.codeDirty = true
    this.updateSyncHints()
    if (this.autoSync) this.scheduleCodeToBlocksSync()
  }

  private markOutOfScopeBlocks(): void {
    this.blocklyPanel?.markOutOfScopeBlocks(this.getVisibleComponents())
    // 🔴 **鷹架的顯示模式也在這裡套用**——與「超出範圍」同一個時機
    //    （畫完之後在既有的積木上蓋一層視覺）。
    this.remarkScaffold()
  }

  /**
   * **只重蓋鷹架那一層**（2026-09-02）。
   *
   * ⚠️ 與 `markOutOfScopeBlocks` 分開，是因為有人只需要這一半：換目標的途中
   * 「這個主題看得到哪些元件」還沒算完，那時去重算「超出範圍」會把整個畫布
   * 判成超出範圍。
   */
  private remarkScaffold(): void {
    // 🔴 **組裝點不再替視圖決定它該畫什麼**（2026-09-06，spec 172）。
    //
    //    這裡曾經是 `blocklyPanel.markScaffoldBlocks(this.scaffoldNodeIds(),
    //    this.scaffoldDepth === 1 ? 'ghost' : 'editable')`——而那一行做了兩件事，
    //    第二件不該是它做的：**「這個深度該畫成 ghost 還是 editable」是視圖的事。**
    //
    //    今天它只說一句「骨架的告示變了，請重發一次」，
    //    而每個視圖自己決定那代表什麼樣子（P1：唯一真實，各式投影）。
    //
    // ⚠️ 那則重發**不帶 `blockState`**，所以積木不會重畫——見
    //    `SyncController.republishScaffold` 的檔頭。
    this.syncController?.republishScaffold()
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
        // 🔴 **換目標可能就換了骨架**（C++ → Arduino），而新的那個未必藏得住
        //    ——使用者看到狀態列寫著「Arduino 骨架・hidden」而積木上骨架好好地在。
        //
        // > **一個「這個狀態到不了」的規則，要在【每一條到得了它的路】上都執行
        // > ——而換目標就是其中一條。**
        this.enforceShellDepthFloor()
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
        // ⚠️ 同上：這一次是**同步**打的，而樹要重投影完才算得準——再補一次。
        this.remarkAfterSettled()
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
  applyHostConfig(cfg: {
    targetId?: string; locale?: string; hostLocale?: string
    styleId?: string | null; blockStyleId?: string
    skeletonId?: string | null; scaffoldMode?: string | null
    /** 這份文件自己說它是什麼——`undefined` ＝ 不要問（使用者明確選過了）。 */
    autoTargetId?: string
  }): void {
    // 🔴 語系先處理——⚠️ 它與目標**互不相干**，而早期的版本因為
    //    `if (!cfg.targetId) return` 寫在最前面，讓它整段被跳過。
    if (cfg.hostLocale) this.hostLocale = cfg.hostLocale
    if (cfg.locale && cfg.locale !== this.localePreference) void this.applyLocalePreference(cfg.locale)
    // 🔴 **其餘偏好在【目標之後】套**——見 `applyPreferences` 的說明。
    const rest = (): void => this.applyPreferences(cfg)
    if (!cfg.targetId) { rest(); return }
    // 🔴 **文件自己說得出身分時，它贏過一份放在那裡的全域設定**（2026-09-01）。
    //
    // 使用者：「我希望的是看到 C++，**因為我語言選 C++**，如果是 .ino 才要
    // Arduino」——而他的全域設定裡有一行 `semorphe.target: arduino`，
    // 於是**每一份文件都被判成 Arduino**，包含 C++ 的。
    //
    // > **一份放在那裡的全域設定，不該蓋掉一份【自己說得出身分】的文件。**
    //
    // ⚠️ 而判準是**家族**不是相等：`arduino-uno` 與 `arduino` 是同一家族
    //    （都用 `arduino` 骨架），那時設定比較具體，該用設定
    //    ——老師把板子釘成 `arduino-uno` 是有意義的，不該被推導洗成 `arduino`。
    //
    // > **一個「更具體的值」與一個「不同種類的值」是兩件事
    // > ——只比對相等的話，兩者都會被當成「不一樣」。**
    const wanted = ((): string => {
      if (!cfg.autoTargetId || cfg.autoTargetId === cfg.targetId) return cfg.targetId!
      const family = (id: string): string =>
        this.targetRegistry.get(id)?.skeleton ?? 'main'
      if (family(cfg.autoTargetId) === family(cfg.targetId!)) return cfg.targetId!
      diagNote(`⚠️ 設定的目標「${cfg.targetId}」與這份文件不同族——` +
        `改用文件自己說的「${cfg.autoTargetId}」。（設定要跟著檔案走的話，` +
        `用語言覆寫：\`"[cpp]": { "semorphe.target": … }\`）`)
      return cfg.autoTargetId
    })()
    const target = this.targetRegistry.get(wanted)
    // 🔴 **認不得就要出聲**——回退到現況是對的，而**靜靜地回退不是**。
    //
    // 2026-08-31：`manifest.ts` 把 `'cpp-beginner'`（一個**課程清單**的 id）
    // 宣告成 `semorphe.target` 的預設值。認不得 → 這一行 return → 目標停在 `cpp`
    // → C++ 的骨架把 `int main()` 接到使用者的 `.ino` 上。
    //
    // 而 `sync/settings.ts:65` 早就寫下了這個病的名字：
    // > 「一個認不得的 ID 在下游是『回退到現況』，所以它**不會出聲**
    // >  ——設定看起來有在運作，實際上這一格從來沒有生效過。」
    //
    // **那句話診斷對了，而沒有人把『出聲』做出來。** 現在做。
    if (!target) {
      diagNote(`🔴 宿主給的目標認不得：「${wanted}」——已回退到現況「${this.currentTarget.id}」。` +
        `登錄的目標：${this.targetRegistry.all().map((t) => t.id).join('、')}`)
    }
    if (!target || target.id === this.currentTarget.id) { rest(); return }
    const topic = this.topicRegistry.get(target.topic)
    if (!topic) {
      diagNote(`🔴 目標「${target.id}」指向的課程清單「${target.topic}」不存在——已回退到現況。`)
      rest()
      return
    }
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
    rest()
  }

  /**
   * 風格／積木風格／骨架／鷹架——**目標套完之後才輪到它們**。
   *
   * 🔴 順序是量出來的（2026-09-01 預檢）：第一版把它們放在 `targetId` 那段
   * **之前**，理由是「它們與目標互不相干」。而預檢當場打臉——設定給
   * `scaffoldMode: 'ghost'`，面板出來仍然是 `hidden`。
   *
   * ⚠️ 因為**換目標會重設骨架與鷹架**（新目標有自己的骨架）。放在前面就是
   * 「先設好，再被覆蓋」。
   *
   * > **兩件事「互不相干」不代表它們的順序無所謂
   * > ——只要其中一件會【重設】另一件的狀態，順序就是它們的關係。**
   *
   * ⚠️ `styleId`／`blockStyleId` **本來就送過來了**（`resolveConfig` 一直有
   * 這兩格），而在此之前從來沒有人讀它們——一條接好而沒有人走的路。
   *
   * > **一份組態如果送了七格而只消費三格，那四格不會出錯
   * > ——它們會安靜地不生效，而設定看起來有在運作。**
   */
  private applyPreferences(cfg: {
    styleId?: string | null; blockStyleId?: string
    skeletonId?: string | null; scaffoldMode?: string | null
  }): void {
    if (cfg.styleId) {
      const style = STYLE_PRESETS.find((p) => p.id === cfg.styleId)
      if (style && style.id !== this.currentStylePreset.id) this.controlCallbacks?.onStyleChange(style)
    }
    if (cfg.blockStyleId && cfg.blockStyleId !== this.currentBlockStyleId) {
      const preset = BlockStyleSelector.byId(cfg.blockStyleId)
      if (preset) this.controlCallbacks?.onBlockStyleChange(preset, {})
    }
    // ⚠️ 骨架先於鷹架：換骨架會清空並重蓋，而鷹架是蓋在它上面的那一層。
    if (cfg.skeletonId && cfg.skeletonId !== this.currentSkeletonId) {
      void this.setSkeleton(cfg.skeletonId)
    }
    // ⚠️ 比對的是**深度**——`scaffoldDepth` 才是狀態，模式只是它的名字。
    if (cfg.scaffoldMode
      && scaffoldDepthOf(cfg.scaffoldMode as ScaffoldMode) !== this.scaffoldDepth) {
      this.setScaffoldMode(cfg.scaffoldMode as ScaffoldMode)
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
      // ⚠️ **改了積木，上一次的「沒跑到」就過期了**——留著會讓學生對著一個
      //    「上一次執行」的結論改東西。
      //
      // 🪦 這一行原本寫在 `wireLessonCheck` 裡，自己 `onChange` 了一次
      //    ——而 `BlocklyPanel.onChange` 是**指派**不是訂閱
      //    （`this.onChangeCallback = callback`）：第二次呼叫會把第一次蓋掉。
      //    當時僥倖沒出事，只因為這一支剛好註冊在後面。
      //
      // > **一個叫 `onXxx` 的方法，如果它是指派而不是訂閱，
      // > 那麼「多接一條線」就是「剪掉原本那一條」。**
      this.blocklyPanel?.clearNeverRan()
      this.blocklyPanel?.clearIterations()
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
    // 🔴 **只有選了課程與章節，「題目」那一格才存在**（使用者 2026-09-04 拍板）。
    //    沒有課的時候「我在做哪一題」這個問題不存在，而一個永遠只有
    //    「純練習」可選的下拉是假的按鈕。
    //
    // ⚠️ 一課有課而**沒有宣告任何題目**時也不畫——那與「還沒寫題目」是同一件事，
    //    畫一個空的選單只會讓人以為壞了。
    if ((this.currentLesson?.tasks.length ?? 0) === 0) pinned.add('task')
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
        // 🔴 **名字表要【全】**（2026-09-02）：選單上列哪幾個是一回事，
        //    而「現在是哪一個」要說得出人話又是另一回事。
        //
        //    使用者看到狀態列寫著「Arduino 骨架・**hidden**」——那是原始 id
        //    漏到畫面上：Arduino 藏不住骨架，於是 `hidden` 不在選單裡，
        //    而狀態卻停在它，標籤就掉回了 `?? mode`。
        //
        // > **一張「給人看的名字」的表，如果它只收得下【現在可以選的】那幾個，
        // > 那麼狀態一旦落在別處，畫面上就會出現一個給機器看的字。**
        const MODE_NAMES: Record<ScaffoldMode, [string, string]> = {
          hidden: ['隱藏', '積木上只留你自己的邏輯'],
          ghost: ['淡的', '看得到、動不了，旁邊寫著為什麼'],
          editable: ['完整', '整支程式，你改得動'],
        }
        // ⚠️ **`hidden` 不是每一種骨架都做得到**（2026-08-28）：
        //    Arduino 有兩個進入點，兩批語句攤平成一串之後**分不回去**
        //    ——那不是「藏起來」，是把資訊弄丟。
        //    使用者：「這也會**被你選什麼目標限制有哪些選擇**」。
        const MODES: readonly [ScaffoldMode, string, string][] =
          (Object.keys(MODE_NAMES) as ScaffoldMode[])
            .filter((m) => m !== 'hidden' || canHideScaffold(cur))
            .map((m) => [m, MODE_NAMES[m][0], MODE_NAMES[m][1]])
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
          // ⚠️ 名字查**全表**，不是查「可以選的那幾個」——見 `MODE_NAMES`。
          label: `${cur?.name ?? this.currentSkeletonId}・${MODE_NAMES[mode]?.[0] ?? mode}`,
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
        // 🔴 **回去讀的那條路**（2026-09-03）：課文有靜態頁了，而編輯器裡
        //    沒有任何地方說得出「這一課有課文可以讀」。
        //
        //    形狀與鷹架那顆一樣——**用前綴分開兩種語義**（`doc:` ＝ 開一個新分頁，
        //    不是換一堂課）。少了前綴的話它會被當成一個課程 id，而那個 id 不存在。
        //
        // > **一份寫好的教材，如果只有搜尋引擎進得去，那它對現在的使用者仍然不存在。**
        if (this.currentLesson && this.codeView?.openExternal) {
          options.unshift({
            value: `doc:${this.currentLesson.id}`,
            label: `📖 看這一課的課文`,
            description: '在新分頁打開，編輯器不會關掉',
          })
        }
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
      case 'task': {
        // 🔴 **「純練習」排在最上面，而它是一個【看得見的狀態】**，
        //    不是「還沒選」。使用者 2026-09-04：「還是先不選擇題目純練習」。
        //
        // ⚠️ 它在這個模式下裁判**完全沉默**，而**執行覆蓋照樣標**
        //    ——那是一條刻意畫的界線：
        //
        // > **描述性的回饋永遠可以給；評價性的回饋要先問過。**
        //
        //    「有 1 塊積木沒有被跑到」只是在說發生了什麼；
        //    「還沒對——你少了第 2 行」是在說對錯。
        const lesson = this.currentLesson
        const tasks = lesson?.tasks ?? []
        const options: ControlOption[] = [
          {
            value: FREE_PRACTICE,
            label: '純練習',
            description: '不對應任何題目——不會有人說你對或錯',
          },
          ...tasks.map((t) => ({
            value: t.id,
            // ⚠️ 打勾**只給過了的**，沒過的那些不放叉——一排叉是一排指責，
            //    而他還沒開始做。
            label: `${lesson && isTaskPassed(lesson.id, t.id) ? '✅ ' : ''}${t.title}`,
            description: t.check ? undefined : '這一題沒有裁判（改寫法、開放題）',
          })),
        ]
        // 🔴 **清除的入口就在進度旁邊**（2026-09-04）——一台電腦換一班學生
        //    是這個工具最可能的部署方式（電腦教室），而藏起來的清除鍵等於沒有。
        //
        // ⚠️ 形狀與「章節」那顆的 `📖 看這一課的課文` 一樣：**用前綴分開兩種語義**
        //    （這一項不是「換一題」，是「做一件事」）。少了前綴會被當成題目 id。
        if (lesson && passedCount(lesson.id, tasks.map((t) => t.id)) > 0) {
          options.push({
            value: CLEAR_PROGRESS,
            label: '🧹 清除學習進度',
            description: '換一班學生用同一台電腦時',
          })
        }
        const done = lesson ? passedCount(lesson.id, tasks.map((t) => t.id)) : 0
        const cur = taskById(lesson, this.currentTaskId)
        return {
          id: spec.id, kind: spec.kind, title,
          // 🔴 標籤帶進度——**「2/3」是這一格唯一說得出「我學到哪」的地方**。
          label: cur ? `${cur.title}　${done}/${tasks.length}` : `純練習　${done}/${tasks.length}`,
          value: this.currentTaskId,
          options,
        }
      }
      case 'layout': {
        // 🔴 標籤走 i18n 鍵（`nameKey`），**不得把 id 印上畫面**
        //    ——第八十一條護欄的硬性零盯著這一點。
        // 🔴 **清單問宿主，不是問宣告**（2026-09-01）。使用者在 VSCode：
        //    「說是四格其實根本不是」——那裡只有流程與積木兩層，
        //    程式碼在 IDE 的編輯器、主控台是 IDE 的終端機。
        //    見 `hostLayoutOptions` 的檔頭。
        //
        // 🪦 **而「這個視窗只畫一層 ⟹ 版面選單消失」那一段退場**（同日稍晚）。
        //
        //    使用者：「**我現在要如何切換佈局？**」→「**我要的就是這個，
        //    你怎麼現在才聽懂？**」
        //
        //    我把版面選單拿掉的理由是「一個只有一個選項的選單是假的按鈕」，
        //    而那個理由**只對一半**：它對「我們自己畫的那張 grid」成立，
        //    卻被我推論成「所以版面這件事我們不談了」。
        //
        // > **把【繪製】交出去，不等於把【談論它】也交出去。**
        //
        // 🟢 於是：宿主自己有版面引擎時（`profile.layers` 指名了這個視窗
        //    畫哪一層），選單端出**宣告的那四張**——它們描述的是**宿主的**
        //    編輯器分組，由 `vscode/editor-layout.ts` 翻譯。
        //    ⚠️ 而那四個名字在那裡第一次是**真的**：程式碼是 IDE 的編輯器、
        //    主控台是 IDE 的終端機，所以「十字（四格）」真的有四格。
        const hostOwnsLayout = (this.profile.layers?.length ?? 0) > 0
        const opts = hostOwnsLayout
          ? LAYOUT_PRESETS.map((p) => {
            // ⚠️ `'*'`（跟著焦點走的那一格）在這裡先解析掉——示意圖畫的是層名，
            //    而 `LAYER_*` 不是一個鍵。
            const areas = p.areas.map((row) => row.map((v) => (v === '*' ? 'space' : v)))
            return { id: p.id, nameKey: p.nameKey, areas, complete: true }
          })
          : this.shellLayoutOptions?.() ?? hostLayoutOptions(() => true)
        const layerName = (l: string): string => msg(`LAYER_${l.toUpperCase()}`, l)
        /**
         * 四層都在 ⟹ 用宣告的名字（網頁版逐字不變）。
         * 少了層 ⟹ **名字由剩下的格子拼出來**，因為宣告的名字在那裡是假話。
         */
        const nameOf = (o: HostLayoutOption): { label: string; description?: string } => {
          // 🔴 **名字與說明分開**（2026-09-02，使用者：「我不想要你寫括號內的字」）。
          //
          //    在此之前名字就是「三欄（程式碼 · 流程 · 積木）」——那串括號在選單裡
          //    是有用的說明，而在**狀態列上**它只是一條長字。
          //
          // > **一個名字與一句說明，在選單裡並排、在狀態列上只留前者
          // > ——把它們寫成同一個字串，就沒有地方可以只留前者。**
          if (o.complete) {
            return { label: msg(o.nameKey, o.id), description: msg(`${o.nameKey}_HINT`, '') || undefined }
          }
          // 🪦 spec 171：版面全是純欄之後，縮減後剩下的一定是**一列並排**
          //    ——本來還要分「上下」與「跨格」那兩種說法。
          const cells = [...new Set(o.areas.flat())].map(layerName)
          if (cells.length === 1) return { label: cells[0] }
          return { label: cells.join(' ｜ '), description: msg('LAYOUT_SIDE_BY_SIDE', '並排') }
        }
        const cur = opts.find((o) => o.id === this.currentLayout) ?? opts[0]
        return {
          id: spec.id, kind: spec.kind, title,
          // ⚠️ 狀態列上要說得出**這是什麼**——一個孤零零的「三欄」在一排
          //    「C++」「Scratch 風格」中間讀不出來它在講版面。
          label: `${msg('LAYOUT_LABEL', '佈局')}：${nameOf(cur).label}`, value: cur.id,
          // 🔴 **示意圖從【同一份宣告】產生**（2026-08-31，spec 168）：
          //    `areas` 就是套用時餵給 CSS 的那一份，所以圖與畫面**不可能**不一致。
          //    ⚠️ 手畫四張圖的話，它們會與宣告漂開，而漂開時沒有任何機構會出聲。
          //    ⚠️ 而它畫的是**縮減後**的 `areas`——否則圖上四格、畫面上兩格。
          options: [
            ...opts.map((o) => ({
              value: o.id, ...nameOf(o),
              previewGrid: { areas: o.areas.map((row) => row.map(layerName)) },
            })),
            // 🔴 **下方面板那兩頁的開關住在版面選單裡**（2026-09-02，使用者要的）。
            //
            //    它們不是版面——三張版面說的是**編輯區怎麼排**，而主控台與變數
            //    在編輯區底下（spec 171）。放在這裡是因為**使用者要調版面的
            //    時候，想的就是這件事**。
            //
            // ⚠️ 標籤說的是**按下去會發生什麼**，不是那個東西的名字：
            //    現在開著就寫「隱藏」，沒開就寫「顯示」（使用者逐字要的）。
            //
            // > **一個開關如果兩種狀態都叫同一個名字，使用者要按下去才知道
            // > 它剛才是開還是關。**
            //
            // ⚠️ 沒有 `previewGrid`：它們不是版面，畫一張圖會讓它看起來像。
            ...BOTTOM_PAGES.map((page) => {
              const name = msg(`PANEL_${page.toUpperCase()}`, page)
              // 🔴 **答不出來就不要說**（2026-09-02）。使用者在 Arduino IDE：
              //    「沒有面板卻還說隱藏」——那個宿主的兩個可見性訊號都說謊
              //    （見 `panel.ts` 的 `canObserveBottomVisibility`）。
              //
              // > **一個「現在是開還是關」的標籤，只在答得出來的時候才該說
              // > ——答不出來時說一個，有一半的時間是騙人的。**
              if (!(this.bottomVisibilityKnown?.() ?? true)) {
                return {
                  value: bottomToggleValue(page),
                  label: msg('LAYOUT_TOGGLE_PANEL', '{panel}面板').replace('{panel}', name),
                  description: msg('LAYOUT_TOGGLE_PANEL_HINT', '顯示／隱藏'),
                }
              }
              const shown = this.bottomVisibility?.()[page] ?? false
              return {
                value: bottomToggleValue(page),
                label: msg(shown ? 'LAYOUT_HIDE_PANEL' : 'LAYOUT_SHOW_PANEL', shown ? '隱藏' : '顯示')
                  .replace('{panel}', name),
              }
            }),
          ],
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
      /**
       * 🔴 **偏好要交給宿主保存**（2026-09-01）——見 `CodeView.persistPreference`。
       *
       * ⚠️ 只有 **picker** 走這裡：它們說的是「這份文件與這個人的偏好」。
       *    action（還原／重做／清空／執行）是**一次操作**，不是一份設定。
       *
       * 🟢 網頁版沒有實作這個方法，於是這一行什麼都不做——它的偏好走存檔。
       */
      const persist = (key: string, value: string | undefined): void => {
        if (value !== undefined) this.codeView?.persistPreference?.(key, value)
      }
      switch (invoke.id) {
        case 'target': {
          // 🔴 **換目標就退出課程**——課的清單是跟著目標走的
          //    （使用者拍板的順序：「先選目標再選課程」）。
          //    留著它的話，畫面會顯示一堂**不屬於這個目標**的課。
          this.currentLesson = undefined
          this.currentTrack = undefined
          this.currentTaskId = FREE_PRACTICE
          const target = this.targetRegistry.get(invoke.value ?? '')
          const topic = target ? this.topicRegistry.get(target.topic) : null
          if (!target || !topic) return
          cb.onTargetChange(target, topic, new Set(flattenLevelTree(topic.levelTree).map((n) => n.id)))
          persist('target', invoke.value)
          break
        }
        case 'scaffold': {
          // 🔴 **前綴長度用 `.length` 算，不要寫數字**（2026-08-31）。
          //    在此之前是 `v.slice(6)`，而 `'skeleton:'` 是 **9** 個字
          //    ——`'skeleton:arduino'.slice(6)` ＝ `'on:arduino'`，查不到那份骨架，
          //    於是 `setSkeleton` 第一行就 return。**選骨架從來沒有真的執行過。**
          //
          //    ⚠️ 症狀不是報錯（console 有一行 error，而沒有人在看）：
          //    畫面上就是「點了骨架，什麼都沒發生」。而它跟隔壁那個
          //    `mode:`（5 個字，剛好對）在同一個 `if/else` 裡，看起來一模一樣。
          //
          // > **兩個手寫的長度並排時，錯的那個看起來與對的那個一樣正常。**
          const v = invoke.value ?? ''
          const SKELETON = 'skeleton:', MODE = 'mode:'
          if (v.startsWith(SKELETON)) { this.setSkeleton(v.slice(SKELETON.length)); persist('skeleton', v.slice(SKELETON.length)) }
          else if (v.startsWith(MODE)) { this.setScaffoldMode(v.slice(MODE.length) as ScaffoldMode); persist('scaffold', v.slice(MODE.length)) }
          break
        }
        case 'template': {
          this.applyTemplate(invoke.value ?? '')
          break
        }
        case 'track': {
          this.selectTrack(invoke.value ?? '')
          persist('topic', invoke.value)
          break
        }
        case 'lesson': {
          const v = invoke.value ?? ''
          // ⚠️ `doc:` 不是一堂課，是「去讀它」——與鷹架的 `skeleton:` / `mode:` 同形。
          if (v.startsWith('doc:')) { this.openLessonDoc(v.slice(4)); break }
          this.selectLesson(v)
          break
        }
        case 'task': {
          // ⚠️ 這一項不是「換一題」，是「做一件事」——與「章節」的 `doc:` 同形
          if (invoke.value === CLEAR_PROGRESS) { this.confirmClearProgress(); break }
          // 🔴 **「排回去」那種題要先鋪畫面**——而它會蓋掉畫布，所以先問一句
          //    （形狀與「套用範例」一樣：選了一題卻沒看到它比被問一句更糟，
          //     而吃掉他寫到一半的東西比兩者都糟）。
          const picked = taskById(this.currentLesson, invoke.value ?? '')
          if (picked?.kind === 'arrange' && this.currentLesson) {
            const lesson = this.currentLesson
            const go = (): void => {
              this.currentTaskId = picked.id
              this.publishControls()
              this.applySuggestedView(picked.view)
              void this.seedArrange(lesson, picked)
            }
            // 🔴 **問語義樹，不問面板**（同 `applyTemplate`）——「有沒有東西」
            //    是那份唯一真實的性質，不是某一個投影的性質。
            const body = this.syncController?.getCurrentTree()?.children?.body ?? []
            if (body.length === 0) { go(); break }
            showQuickPick(
              {
                title: `開始「${picked.title}」？畫布上現在的東西會被換掉`,
                items: [
                  { value: 'yes', label: '開始（現在的內容會被換掉）' },
                  { value: 'no', label: '取消' },
                ],
              },
              (v) => { if (v?.[0] === 'yes') go() },
            )
            break
          }
          // ⚠️ **不 persist**：它是 `session` 域的（跟課程與章節同一層）。
          //    「我現在做哪一題」跨裝置記住是錯的——那不是一份偏好。
          this.currentTaskId = invoke.value ?? FREE_PRACTICE
          this.publishControls()
          // 🔴 **只在換題這一條路套用**——見 `applySuggestedView` 的檔頭：
          //    在重畫時再套一次，就是把「建議」變成「鎖」。
          this.applySuggestedView(taskById(this.currentLesson, this.currentTaskId)?.view)
          break
        }
        case 'style': {
          const style = STYLE_PRESETS.find((p) => p.id === invoke.value)
          if (style) { cb.onStyleChange(style); persist('style', invoke.value) }
          break
        }
        case 'blockStyle': {
          const preset = BlockStyleSelector.byId(invoke.value ?? '')
          if (preset) { cb.onBlockStyleChange(preset, {}); persist('blockStyle', invoke.value) }
          break
        }
        case 'locale':
          // ⚠️ 與其餘四顆同形——都走 `controlCallbacks`，沒有第二條路。
          if (invoke.value) { void cb.onLocaleChange(invoke.value); persist('locale', invoke.value) }
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
          const id = (invoke.values?.[0] ?? invoke.value) as string | undefined
          // 🔴 下方面板的開關與版面走**同一個選單**，但它不是一張版面
          //    ——所以在這裡岔開，不去碰 `currentLayout`。
          const page = bottomPageOf(id)
          if (page) {
            this.toggleBottom?.(page)
            // 🔴 **重畫控制項**——標籤要從「顯示」翻成「隱藏」。
            this.publishControls()
            break
          }
          if (id && layoutPreset(id as LayoutPresetId)) {
            this.currentLayout = id as LayoutPresetId
            this.applyLayout?.(id as LayoutPresetId)
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

    // ─────────────────────────────────────────────────────────────
    // 🔴 **我是【產生輸出的人】還是【畫輸出的人】？**（2026-09-02）
    //
    // 使用者：「執行了一次，結果字被銜接在之後，然後還是一直閃」。
    //
    // 主控台搬進宿主的 panel 區之後有兩種視窗：跑程式的（積木／流程）與
    // 畫輸出的（主控台）。而第一版**兩邊都接了兩個方向**，於是畫的人
    // 把它畫下來的每一個字**又報回宿主**，宿主再轉回來——一個回音圈。
    //
    // > **同一個面板，「把它畫出來」與「把它報出去」不能同時接
    // > ——那不是兩個功能，那是一個迴圈。**
    //
    // 判準問宣告：`output` 投影到 `panelBottom` ＝ **這個視窗自己畫**。
    // ─────────────────────────────────────────────────────────────
    const spec = CONTROLS.find((c) => c.id === 'console')
    const drawsLocally = !!spec
      && consoleRole(surfaceOf(spec, this.profile.controlSurfaces)) === 'draw'

    if (!drawsLocally) {
      // 【產生的人】：把輸出送出去，宿主會轉給畫的人。
      consolePanel.onOutput((chunk: string) => view.reportConsole?.(chunk))
      consolePanel.onClear(() => view.clearConsole?.())
      consolePanel.onInputRequested((prompt) => view.reportConsoleAwaitingInput?.(prompt))
      // 🔴 宿主打不開終端機 → 主控台還給面板（Arduino IDE，2026-08-25 實測）。
      //    🟢 而輸出不會掉：`ConsolePanel` 一直都在畫，終端機只是它的鏡射。
      view.onConsoleFallback?.(() => this.enableConsoleTab?.())
      // ⚠️ 使用者在**別的地方**（宿主的終端機／主控台視圖）打的那一行
      view.onConsoleInput?.((line: string) => consolePanel.feedInput(line))
      // 🔴 **狀態也要送**——不然畫的那一側會停在「等待輸入…」，
      //    而程式其實早就印完了（使用者 2026-09-02 的截圖）。
      this.bus.on('execution:state', (e) =>
        view.reportExecutionState?.({ status: e.status, reason: e.reason }))
      return
    }

    // 【畫的人】：把宿主轉過來的畫出來，而**不再報回去**。
    // ⚠️ 狀態列也是「畫」的一部分——它說的是「程式現在怎麼樣」。
    view.onExecutionStateIn?.((e) =>
      consolePanel.onExecutionState({ status: e.status as never, reason: e.reason as never }))
    view.onConsoleOut?.((m) => {
      if (m.clear) consolePanel.clear()
      if (m.chunk !== undefined) consolePanel.write(m.chunk)
      // ⚠️ 等輸入時開一個輸入框，而答案要回到**跑的那一邊**。
      if (m.awaitingInput !== undefined) {
        void consolePanel.promptInput(m.awaitingInput).then((line) => view.submitConsoleInput?.(line))
      }
    })
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
  private sideCarUsable(state: SavedState): state is SavedState & { blocklyState: object } {
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

  /**
   * ⚠️ **不是 `private`**（2026-09-06，spec 173）——
   * `e2e/sidecar-droppable.spec.ts` 要逼它存一次，才驗得了
   * 「存檔缺一格時載入怎麼辦」。
   *
   * 🔴 而那不是一個測試後門：存檔本來就是**組裝點的一個動作**，
   * 而「什麼時候存」與「存了之後怎麼載」是兩件事——那一支驗後者。
   */
  autoSave(): void {
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
    // 🔴 **全新的一頁也要走一次同步**——而在此之前它直接 return。
    //
    // 2026-08-31 使用者回報：「一開始打開的時候畫面是空的，拉積木也沒反應，
    // 我是去載入範例才開始有反應。」實測（`e2e/first-run.spec.ts`）：
    //
    // ```
    // 開機   code:""  blocks:0  staleReason:'not-rendered'
    // 拉一顆 code:""  blocks:1  staleReason:'not-rendered'   ← 積木進去了而程式碼沒動
    // ```
    //
    // 機制：`hasRendered` 只在**匯流排畫過樹**時才變 true
    // （`blockly-panel.ts:333`）。沒有存檔 ⟹ 沒有東西可畫 ⟹ 它永遠是 false
    // ⟹ `staleReason` 永遠是 `'not-rendered'` ⟹ 每一次積木編輯都被
    // `syncBlocksToCodeWithMappings` 的殘態守衛擋掉，而那道守衛**刻意不出聲**
    // （它以為自己處在開機的過渡狀態）。
    //
    // > **一道「等畫過再說」的閘，遇到「永遠不會被畫」的情況時，
    // > 不會變成錯誤——它會變成一個安靜的死結。**
    //
    // ⚠️ 而它**擋不住第一次載入範例**：那條路自己會畫一次樹，於是閘解除
    //    ——這正是使用者說「載入範例才開始有反應」的原因。
    //
    // 🔴 **`refused` 那條【不能】比照辦理**：那時存檔是存在而載不進來的，
    //    凍住是為了不讓一次自動存檔把它蓋掉（上面那段註解的理由）。
    //    ⚠️ 兩條早退看起來一樣，而它們的最壞情況相反。
    if (outcome.kind === 'empty') {
      // 🔴 **有外部文件的宿主：一個字都不准寫。**
      //
      // 2026-08-31 使用者：「我用 Arduino IDE 把 semorphe 開起來，
      // 原本的 `setup` 和 `loop` 會被 C++ 預設骨架覆蓋」。
      //
      // 這一行（同日稍早加的）從**空工作區**產生 `int main(){}` 並寫進
      // `codeView`——而在擴充裡那是「算出範圍 → 交給宿主寫回」，
      // **它蓋掉了使用者的 .ino**。宿主的 `document` 訊息是一次 postMessage
      // 往返，**必然比開機晚到**。
      //
      // > **一個「補一份預設內容」的動作，在內容還在路上的時候，
      // > 補的是「還沒到」那個狀態的預設值。**
      //
      // ⚠️ 判準問的是**視圖的能力**，不是宿主的名字——`if (host === 'vscode')`
      //    會讓宣告退化成標籤（第六十三條護欄的判準）。
      //
      // 🟢 而擴充那側**不需要**這一行：文件送到時 `changeCb` 會觸發
      //    code→blocks，那條路自己會畫一次樹、解開那道殘態閘。
      if (!this.codeView?.documentBacked) this.resyncAfterTopicChange()
      return
    }

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
    // 🔴 **課釘住的目標，存檔蓋不掉**（2026-09-03）。
    //
    //    `?lesson=` 在**建構子**裡就把目標定了，而這一段稍後才跑
    //    ——它原本無條件把存檔裡那個目標寫回去。於是老師貼出去的連結，
    //    在**任何一個用過別的目標的瀏覽器上**會落在一個混合狀態：
    //    狀態列寫著上一次的目標，而骨架與課程是這一課的。
    //
    //    使用者截圖（2026-09-03）：`?lesson=cpp-beginner/15-多層迴圈`
    //    而狀態列第一格寫著「Python」。
    //
    // > **一條連結如果會被「這台電腦上次做了什麼」改寫，
    // > 它就不是一條可以貼給別人的連結。**
    //
    // ⚠️ 只擋**課釘住的那一格**——沒有課的時候存檔仍然說了算。
    const pinnedTarget = this.currentLesson?.pins.target
    if (savedTarget && pinnedTarget === undefined) this.currentTarget = savedTarget
    // ⚠️ 還原也要跟著換外殼——否則存檔存的是 Arduino，開起來卻套 `main()`。
    this.scaffold?.setSkeleton?.(this.currentTarget.skeleton ?? 'main')
    // ⚠️ 課程主題也跟著——`savedTarget` 被擋掉時，別再從它推主題。
    const topicId = pinnedTarget !== undefined
      ? this.currentTopic.id
      : (savedTarget?.topic ?? state.topicId)
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
        // 🔴 **課在的時候，層級由課說了算**（2026-09-03，第二刀）。
        //
        //    上一刀只擋住「目標」，而**層級是另一格**——於是存檔裡那份
        //    （上一次待的主題留下的分支集合）照樣寫回來，與這一課的主題
        //    交集之後幾乎是空的。
        //
        //    使用者：「多層迴圈的積木應該不只這些吧」——工具箱上只剩
        //    「資料」與「輸入/輸出」，而那一課宣告的 `cpp:loop_count`
        //    屬於「控制」，被交集掉了。
        //
        // > **一個「存檔蓋掉課程」的缺陷修一格是不夠的
        // > ——課程釘住的是【一組】決定，而存檔也是一組。**
        //
        // ⚠️ `applyLesson` 已經把它設成「這個主題全開」（收窄由課的
        //    `components` 做，不由層級做）——這裡只要不覆蓋它。
        if (pinnedTarget === undefined) {
          this.enabledBranches = state.enabledBranches
            ? new Set(state.enabledBranches)
            : new Set([topic.levelTree.id])
        }
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
