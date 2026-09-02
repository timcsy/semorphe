import * as Blockly from 'blockly'
import { LAYER_ORDER } from '../core/view-host'
import { msg } from '../core/messages'
import { showQuickPick } from './toolbar/quick-pick'
import { installGridDividers } from './layout/grid-dividers'
import { identityAssignment, swapTo, effectiveAreas, type SlotAssignment } from '../core/host/slot-assignment'
import { createPanelHead } from './layout/cell-head'
import { BottomPanel } from './layout/bottom-panel'
import { LayoutManager } from './layout/layout-manager'
import { MobileTabBar, type TabId } from './layout/mobile-tab-bar'
import { ConsolePanel } from './panels/console-panel'
import { VariablePanel } from './panels/variable-panel'
import { FlowPanel } from './panels/flow-panel'
import { BlocklyPanel } from './panels/blockly-panel'
import type { CodeView } from '../core/host/code-view'
import type { HostProfile } from '../core/host/host-profile'
import { CONTROLS, RUN_MODES, surfaceOf, panelControls, type ControlId } from '../core/host/controls'
import { LAYOUT_PRESETS, layoutPreset, hostLayoutOptions, type LayoutPresetId, type HostLayoutOption } from '../core/host/layout-presets'
import type { UnderstandingLayer } from '../core/view-host'
import { QuickAccessBar } from './toolbar/quick-access-bar'
import { CodeKeyboard } from './panels/code-keyboard'
import type { StorageLike } from '../core/host/host-profile'
import type { SavedState } from '../core/storage'
import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { StylePreset, Target, Topic } from '../core/types'
import type { BlockStylePreset } from '../languages/style'
import { showToast } from './toolbar/toast'

export interface AppShellElements {
  blocklyPanel: BlocklyPanel
  /**
   * 程式碼那一側的**角色**。
   *
   * ⚠️ 網頁版是內建的編輯器面板；而編輯器不歸我們管的宿主會給一個**代理**
   * ——`ui/app.ts` 與 `ui/execution-controller.ts` 只認識這個角色。
   */
  codeView: CodeView
  consolePanel: ConsolePanel
  variablePanel: VariablePanel
  flowPanel: FlowPanel
  /** 🔴 這個宿主可能一格都不需要——那時它不存在，不是空的。 */
  bottomPanel: BottomPanel | null
  /** 🔴 **這個宿主可能一顆快速列控制項都沒有**——那時它不存在，不是空的。 */
  quickAccessBar: QuickAccessBar | null
  layoutManager: LayoutManager
  mobileTabBar: MobileTabBar | null
  codeKeyboard: CodeKeyboard | null
  /** 切換 editor 區顯示哪一個投影（積木／流程）。 */
  showProjection: (which: 'blocks' | 'flow') => void
  /** 套一個桌機佈局預設（專注／對照／三欄）。 */
  applyLayout: (id: LayoutPresetId) => void
  /**
   * **這個宿主提供得出來的版面**——名字從實際的格子導出，塌成同形狀的只留一張。
   *
   * 🔴 由 shell 回答，因為「這一層在不在」問的是 `profile.features` ＋
   * 有沒有那個面板——而那兩件事只有這裡知道（見 `layerAvailable`）。
   */
  layoutOptions: () => readonly HostLayoutOption[]
  /** 把主控台那一格加回下方面板（宿主打不開終端機時）。 */
  enableConsoleTab: () => void
  /** 那條列**晚一點才建**時通知——執行控制器手上是建構當時的那一份。 */
  onBottomPanelReady: (cb: (panel: BottomPanel) => void) => void
}

export interface AppShellCallbacks {
  onTargetChange: (target: Target, topic: Topic, enabledBranches: Set<string>) => void
  onBranchesChange: (enabledBranches: Set<string>) => void
  onStyleChange: (style: StylePreset) => void
  onBlockStyleChange: (preset: BlockStylePreset, toolbox: object) => void
  onLocaleChange: (locale: string) => void
  /** 🔴 一個入口，而不是每個方向一顆——見 `core/sync-coordinator.ts` */
  onOpenSyncMenu: () => void
  /** 🪦 `onUndo`／`onRedo`／`onClear` 已於 2026-08-25 刪除——它們變成登錄表的一列，
   *  由 `setupToolbarButtons` 一次接完（見那裡的檔頭）。 */
  getExportState: () => SavedState
  importState: (state: SavedState) => void
  onUploadCustomBlocks: (blocks: object[]) => void
}

/**
 * 執行模式的選單標記——🔴 **由 `RUN_MODES` 產生，不再手寫**。
 *
 * ⚠️ 在此之前那份清單散在三處（這裡的標記、`execution-controller.ts` 的
 * 型別聯集與標籤查表），而宿主那側還要第四份。
 */
function runGroupMarkup(): string {
  const options = RUN_MODES.map((m) =>
    `${m.separatorBefore ? '<div class="run-mode-separator"></div>' : ''}` +
    `<div class="run-mode-option" data-mode="${m.id}">${m.label}</div>`).join('')
  return `<div class="run-group">
        <button id="run-btn" class="exec-btn run" title="執行">▶ 執行</button>
        <button id="run-mode-btn" class="exec-btn run run-mode-arrow" title="執行模式">▾</button>
        <div id="run-mode-menu" class="run-mode-menu" style="display:none">${options}</div>
      </div>`
}

/**
 * 專案的家。⚠️ **只有一處**——第二處會在改名或搬家的那天安靜地指向舊的地方。
 */
const GITHUB_URL = 'https://github.com/timcsy/semorphe'

/**
 * GitHub 的商標（Octocat mark，16×16）——**內嵌**，不是一個請求。
 *
 * 🔴 這是「離線可用」與「要有 GitHub 標誌」兩個要求同時成立的唯一形狀：
 * 一個 `<img src="https://github.com/…">` 會讓第四十五條當場紅，
 * 而它換來的只是同一個圖形。
 *
 * ⚠️ `fill="currentColor"`：它跟著按鈕的文字色走，
 * hover 與 focus 時不會留下一塊顏色對不上的圖。
 */
const GITHUB_MARK = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z'

export function createAppLayout(
  appEl: HTMLElement,
  blockSpecRegistry: BlockSpecRegistry,
  toolbox: object,
  /**
   * 🔴 這個宿主有什麼、沒有什麼。
   *
   * ⚠️ **不要在這個檔裡問「現在是哪一個宿主」** ——問 `profile.features`。
   * 一旦有人寫 `profile.id === '…'`，這份宣告就退化成一個標籤
   * （由 `tests/integration/host-contract.test.ts` 釘住）。
   */
  profile: HostProfile,
  /**
   * 🔴 **語言相關的東西一律從這裡透傳**（spec 153）——這個檔**不認得**它們。
   * 組裝點是 `app.ts`（護欄明寫「可見，不入棘輪」）。
   */
  languageWiring?: {
    buildProgramRoot?: (body: never[]) => never
    installExtractStrategies?: (extractor: never) => void
  }
): AppShellElements {
  const layoutManager = new LayoutManager()

  // Create toolbar
  //
  // 🔴 **每一顆控制項建不建，問登錄表**（`core/host/controls.ts`）——
  //    不是問「現在是哪個宿主」，也不是每一顆各給一格布林。
  //    ⚠️ 關掉 ＝ **不建那些 DOM**（FR-006），不是建了再藏起來。
  const surfaces = profile.controlSurfaces
  /** 這一顆畫在**工具列**上嗎。⚠️ 畫在狀態列上的不算——那是另一個表面。 */
  const inToolbar = (id: ControlId): boolean => {
    const spec = CONTROLS.find((c) => c.id === id)
    return !!spec && surfaceOf(spec, surfaces) === 'panelToolbar'
  }
  /** 這一顆畫在**面板自己的狀態列**上嗎。 */
  const inStatusBar = (id: ControlId): boolean => {
    const spec = CONTROLS.find((c) => c.id === id)
    return !!spec && surfaceOf(spec, surfaces) === 'panelStatusBar'
  }
  /**
   * 檔案選單——🔴 **在標題右邊，像一般視窗軟體的功能表列**
   * （使用者 2026-08-25：「應該放在 Semorphe 右邊，像是一般視窗軟體那樣」）。
   *
   * ⚠️ 它原本在積木上方那條快速列裡，而那是「操作積木的地方」
   * ——**開檔存檔跟積木沒有關係**，與這一刀把 picker 移出去是同一個判準。
   *
   * 🔴 而它是一個【可以不存在】的東西：一個「檔案由 IDE 管」的宿主裡，
   * 面板再放一份會有兩個「目前的檔案」。⚠️ 處置是**不建**，不是 `display:none`：
   *
   * > **一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
   * > ——因為它讓「像」變成一個謊。**
   */
  const fileMenu = profile.features.fileButtons ? `
      <div class="file-menu-group">
        <button id="file-menu-btn" title="檔案">檔案 ▾</button>
        <div id="file-menu" class="file-menu" style="display:none">
          <div class="file-menu-option" id="export-btn">匯出</div>
          <div class="file-menu-option" id="import-btn">匯入</div>
          <div class="file-menu-option" id="upload-blocks-btn">上傳自訂積木</div>
        </div>
      </div>` : ''

  /**
   * **在 GitHub 給星星**——星星 ＋ 數字，放在「執行」**左邊**
   * （使用者 2026-08-30 指定的位置）。
   *
   * 🔴 **不是 GitHub 官方那顆 iframe**（`ghbtns.com`）：它是淺色的、樣式改不到、
   * 載不出來時是一個空洞，而且是一段別人的程式碼跑在我們的頁面上。
   * 這裡自己畫，商標**內嵌 SVG**。
   *
   * 🪦 **星星數拿掉了**（使用者 2026-08-30：「我覺得不用把目前星星數寫出來」）。
   * 而那一刀連帶把**這個專案的第一個外部請求**收掉了：
   *
   * ```
   * 有數字   要打 api.github.com → 第四十五條要從「硬性零」改寫成「只准是裝飾」
   *          ＋ 一支「把那個主機擋掉還要能用」＋ 一個具名豁免 ＋ 一份快取
   * 沒數字   零外部請求，第四十五條【一個字都不用動】
   * ```
   *
   * > **一個看起來只是「少顯示一個數字」的決定，
   * > 收掉的是一整條相依、一次判準改寫、與一份快取。**
   */
  // 🔴 **不新增一格布林**——第六十三條護欄逐字：
  //    「加一顆控制項，不得再多一格布林——`HostFeatures` 只准下降」
  //    「那條路會爆炸，登錄表才不會」。
  //
  //    ⚠️ 而它教的東西比字面更廣：星星**不是控制項**，可是同一個道理成立
  //    ——它跟著「**這個宿主自己畫不畫這條工具列**」走，而那件事
  //    `controlSurfaces` 已經宣告過了（`inToolbar('run')`：執行畫在這裡嗎）。
  //
  // 🟢 它就住在「執行」旁邊，所以它跟著「執行」的家走。零新增欄位。
  //    VSCode 那側 `action → hostTitleBar`，於是這顆自然不存在——
  //    而那是對的：**那個面板住在使用者自己的專案裡，
  //    在那裡放一顆「給我們星星」是替自己打廣告。**
  const githubStar = inToolbar('run') ? `
      <a class="github-star" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer"
         title="到 GitHub 給這個專案一顆星"
        ><svg class="github-star-mark" viewBox="0 0 16 16" width="15" height="15"
              aria-hidden="true" focusable="false"><path fill="currentColor" d="${GITHUB_MARK}"/></svg
        ><span class="github-star-label">Star</span></a>` : ''

  const headerActions = [
    inToolbar('style') ? '<span id="style-selector-mount"></span>' : '',
    inToolbar('locale') ? '<span id="locale-selector-mount"></span>' : '',
    // 🔴 **星星在「執行」左邊**——使用者 2026-08-30 指定。
    //    ⚠️ 而它在分隔線的**外側**：分隔線隔開的是「這個專案」與「對程式做什麼」。
    githubStar,
    inToolbar('run') ? `<span class="toolbar-separator"></span>${runGroupMarkup()}` : '',
    // ⚠️ 這兩顆屬於行動版，不是控制項登錄表的成員——它們的開關一直是 `mobileLayout`。
    profile.features.mobileLayout
      // 🔴 **同步那顆拿掉了**（2026-08-25）：行動版的狀態列已經有一顆，
      //    而它同時是顯示處與入口。
      //
      // > **同一件事在同一個畫面上有兩個開關，是一個必然會不一致的東西。**
      ? '<button id="hamburger-btn" class="hamburger-btn" title="設定">☰</button>' 
      : '',
  ].join('')

  // 🔴 **一條沒有任何控制項的工具列，剩下的只有商標**——而分頁標題已經寫著
  //    「Semorphe 積木」。在一個窄面板裡那一條就是純粹的浪費。
  //    ⚠️ 所以是**不建**，同一條規則。
  let toolbar: HTMLElement | null = null
  if (headerActions !== '' || fileMenu !== '') {
    toolbar = document.createElement('header')
    toolbar.id = 'toolbar'
    toolbar.innerHTML = `
    <div class="toolbar-left">
      <img src="logo.svg" alt="Semorphe" class="toolbar-logo">
      <span class="toolbar-title">Semorphe</span>${fileMenu}
    </div>
    <div class="toolbar-actions">${headerActions}</div>
  `
    appEl.appendChild(toolbar)
  }

  /**
   * **行動版唯一的一條工具列**（在標頭底下、`main` 上面）。
   *
   * 使用者 2026-08-31：「我希望第二列也都包含原先存在的工具列，
   * **總之整合成一個工具列**」，隨後「**然後其他視圖要跟進**」。
   * 在此之前行動版有五條各自為政的：
   *
   * ```
   * 標頭                    全域動作（而 ↩↪ 塞進去會把它擠爆）
   * 快速列                  只在【積木】分頁裡（它被搬進 mobileBlocksContainer）
   * 流程工具列              只在【流程】分頁裡（它住在流程面板的容器裡）
   * 剪貼工具列              只在【程式碼】分頁裡（它貼在編輯器上面）
   * 下方面板分頁列          只在【主控台】分頁裡（主控台／變數 ＋ 複製／清除）
   * ```
   *
   * 現在五份都住進這一列，而**依分頁顯示對應的那一段**——
   * 一條列、內容跟著你在看哪個投影走。⚠️ 而「幾乎都合併了」等於沒合併：
   * 只要還有一個投影自己帶一條，使用者看到的就還是兩層。
   *
   * 🔴 ↩↪ 是**唯一全域**的那一段：還原動的是語義樹，不是某一個投影，
   *    所以它每個分頁都在（那正是這一刀最早要解決的事）。
   *
   * 🔴 第一版把 ↩↪ 塞進標頭的 `.toolbar-actions`，而使用者 2026-08-31
   * 在真的手機上（約 390px）截圖回報：**標頭被擠爆了**——「▶ 執行」折成兩行、
   * ↩↪ 疊在一起。⚠️ 而我在 500px 的 e2e 上量到的是 32x28，看起來很正常。
   *
   * > **一個「量得到就算過」的寬度，不是使用者手上那一支的寬度。**
   *
   * 所以改成自己一列：它在標頭底下、`main` 上面，**每一個分頁都看得到**
   * （這正是這一刀要解決的事），而不跟標頭搶那一行的寬度。
   *
   * ⚠️ 桌面版**不建也不顯示**——那時 ↩↪ 住在快速列的 `#undo-slot` 裡。
   */
  const mobileActionBar = document.createElement('div')
  mobileActionBar.id = 'mobile-action-bar'
  mobileActionBar.style.display = 'none'
  appEl.appendChild(mobileActionBar)

  /**
   * **四個投影各交出自己那一段**（使用者 2026-08-31：「然後其他視圖要跟進」）。
   *
   * 第一版只搬了兩段（積木的快速列、流程的工具列），而另外兩個投影
   * **各自還留著一條自己的橫列**——於是行動版看起來還是兩層：
   *
   * ```
   * 程式碼分頁   #mobile-action-bar（只有 ↩↪）
   *             .monaco-clipboard-bar   ← 自己一條，貼在編輯器上面
   * 主控台分頁   #mobile-action-bar（只有 ↩↪）
   *             .bottom-panel-tabs      ← 自己一條（主控台／變數＋複製／清除）
   * ```
   *
   * > **「整合成一條」不是「把某幾條整合起來」——
   * > 只要還有一個投影自己帶一條，使用者看到的就還是兩層。**
   *
   * 🔴 每一段配一個分頁：這一列同時只顯示**目前這個投影**那一段
   *（見 `activateMobilePanel`）。全域的 ↩↪ 不在這張表裡——它每個分頁都在。
   *
   * ⚠️ 選擇器是**全文件**的，不是各自容器裡找：一段被搬進來之後就不在
   *    原容器裡了，而這個函式要能重跑（下面那段講為什麼）。
   */
  const ACTION_BAR_SECTIONS: ReadonlyArray<{ sel: string; tab: TabId }> = [
    { sel: '.quick-access-bar', tab: 'blocks' },
    { sel: '.flow-toolbar', tab: 'flow' },
    { sel: '.monaco-clipboard-bar', tab: 'code' },
    { sel: '.bottom-panel-tabs', tab: 'console' },
  ]

  /**
   * 把還沒進來的段落搬進這一列。**可以重跑，而且必須可以重跑**：
   *
   * 🔴 **有兩段不保證在切版面的那一刻就存在**——
   *    `.bottom-panel-tabs` 要等 `enableConsoleTab`（宿主探測失敗才補建），
   *    `.monaco-clipboard-bar` 要等編輯器 `init()`。晚到的那一段如果沒有
   *    人再搬一次，它就留在原處變成第二條列——**而那正是這一刀要消滅的東西**。
   *
   * ⚠️ 已經在這裡的就不動：`appendChild` 對「已經是子節點」的元素仍然是
   *    一次移除再插入，會讓裡面正在被按的按鈕失焦。
   */
  const adoptActionBarSections = (): void => {
    const undoGroup = document.getElementById('undo-group')
    // 🔴 ↩↪ 排在最前面，而且**不跟著快速列進積木那一格**：還原動的是語義樹，
    //    不是某一個投影。⚠️ 沒有它的宿主就跳過，不要搬一個不存在的東西。
    if (undoGroup && undoGroup.parentElement !== mobileActionBar) mobileActionBar.appendChild(undoGroup)
    for (const { sel } of ACTION_BAR_SECTIONS) {
      const el = document.querySelector(sel)
      if (el && el.parentElement !== mobileActionBar) mobileActionBar.appendChild(el)
    }
    // ⚠️ 一段都沒有的宿主就整列不顯示——**不要留一條空的**。
    mobileActionBar.style.display = mobileActionBar.children.length > 0 ? '' : 'none'
  }

  // Create main area with split pane
  const main = document.createElement('main')
  main.id = 'editors'
  appEl.appendChild(main)
  // 🔴 **方向由「有沒有程式碼那一格」決定**，不是另一個旗標。
  //    有：左右分（積木 ‖ 程式碼＋主控台）——網頁版。
  //    沒有：上下分（積木在上、主控台在下）——否則主控台會霸佔右半整條，
  //    而那不是「像網頁版」，是把空出來的位置留給了錯的東西。
  /**
   * 程式碼那一欄**有沒有東西**。
   *
   * 🔴 而「有沒有」是兩件事的聯集：那一格編輯器，以及下方面板。
   *
   * ⚠️ 2026-08-25 之前這裡只問了前者——而主控台與變數搬去宿主之後，
   * 那一欄**整個是空的**，卻仍然分掉了半個高度：
   * 使用者看到的是「積木上面一大塊空白」。
   *
   * > **一個切成兩半的版面，只有在兩半都有東西的時候才是「分割」；
   * > 否則它只是把一半送走。**
   */

  /**
   * **編輯區是一張 CSS Grid**（2026-08-31，spec 168）。
   *
   * 🪦 在此之前是 `SplitPane`（兩個面板、一條分隔線）＋ 巢狀 flex。
   * 那個形狀撐不到「十字」——四層各一格是**二維**的，而巢狀 flex 表達它的方式
   * 是「每個版面一套 DOM 手術」，那正是使用者感覺到的不對稱的來源：
   *
   * > 「你現在把積木和流程用 tab 切換我不太喜歡，
   * >  **因為這樣程式碼面板就變得比較特別了**」
   *
   * 🟢 grid 之下四個面板是**平等的直接子節點**，各自帶一個 `grid-area`，
   * 而版面只是一句 `grid-template-areas`——沒有任何一層需要特別待遇。
   */
  main.style.display = 'grid'
  main.style.position = 'relative'
  main.style.minHeight = '0'
  main.style.overflow = 'hidden'

  // Create status bar
  // 🔴 關掉 ＝ **不建**（FR-006），不是建了再藏起來——宿主自己有一條。
  //    ⚠️ 而「不建」有一個義務跟著：三態要改由 `reportSyncPhase` 送出去，
  //       否則它會**安靜地消失**。見 `core/host/host-profile.ts` 的 `statusBar`。
  if (profile.controlSurfaces.indicator === 'panelStatusBar') {
    const statusBar = document.createElement('footer')
    statusBar.id = 'status-bar'
    // 🔴 **投影到這條列的 picker 畫在這裡**（`draft/版面與檔案` §六：
    //    `statusBar  語言 · 風格 · 同步狀態 · 目前主體`）。
    //
    // ⚠️ 而它們是**文字項目 ＋ QuickPick**，不是 `<select>`
    //    ——使用者 2026-08-25：「狀態列長得跟 IDE 盡可能一樣」「選單也是學 IDE」。
    //    內容由 `layout/status-bar-controls.ts` 依 `ControlState` 畫，
    //    **與 VSCode 那側讀同一份描述**。
    //
    // 🔴 **同步是這條列上的一顆按鈕，不是一段字**。
    //    ⚠️ 第一版把 picker 搬進來，而把 `⇄ 同步` 那顆留在工具列的判斷刪掉了
    //    ——於是三態還看得見，**而按不下去**：入口整個沒了。
    //
    // > **把一顆按鈕換成一段長得一樣的字，
    // > 使用者要按到第二次才會發現它壞了。**
    //
    // 沿用 `sync-menu-btn` 這個 id——`setupToolbarButtons` 因此照樣接得上。
    const syncBtn = inStatusBar('sync')
      ? '<button id="sync-menu-btn" class="status-item-btn status-sync-btn" title="同步">⇄ 同步</button>'
      : ''
    // 🔴 **整組靠右**，而且順序照 IDE 那側（使用者 2026-08-25：「應該靠右，
    //    跟 IDE 一樣」）：`vscode/panel.ts` 給同步的優先序是 100、給 picker
    //    是 99 遞減，而 VSCode 右側**優先序愈大愈靠左**——
    //    於是那邊的順序就是「同步 → 五顆 picker」。這裡逐字對上。
    //    ⚠️ 語言掛在最右，那是 VSCode 擺語言模式的位置。
    statusBar.innerHTML =
      '<span class="status-spacer"></span>' +
      `${syncBtn}` +
      '<span id="status-controls" class="status-controls"></span>' +
      '<span id="status-summary">Loading...</span>' 
    appEl.appendChild(statusBar)
  }

  // 🪦 `#mobile-selector-parking` 已於 2026-08-25 刪除。
  //
  // 它存在的理由是「桌機的狀態列改成文字項目之後，那四顆 `<select>`
  // 沒有地方可待」——而現在**根本沒有那四顆**：行動版讀同一份宣告。
  //
  // > **一個「暫存處」通常是在替另一個機制的存在付租金。**


  // Left panel: QuickAccessBar + Blockly
  // 🔴 **程式碼在左、積木在右**（使用者 2026-08-25：「程式碼視圖應該預設在
  //    左邊，像一般 IDE 的習慣」）。
  //
  // ⚠️ 而它與 IDE 那側是同一個版面：VSCode 的編輯器在左，積木面板開在右。
  //    於是「在網頁版練熟的手」直接搬得過去。
  //
  // 🔴 變數名跟著改成 `blocksColumn` / `codeColumn`——**不再叫左右**：
  //
  // > **一個叫做 `blocksColumn` 而其實在右邊的變數，
  // > 會讓下一個人把版面讀反。**
  // ⚠️ 不切的時候，積木**就是** `main` 本身——不是「一個佔滿的子欄」。
  // 🔴 **它是 grid 的一格**（`space`），不再是「切出來的右半」——
  //    所以 `codeSideHasContent` 不再改變它是誰。用不到的層由軌道大小 0 收掉。

  /**
   * **一格 ＝ 一個容器**（spec 170 · T016）。
   *
   * 🔴 四段一模一樣的 `createElement` ＋ `gridArea` ＋ 五行 style 收成這裡。
   *    它們之間唯一真的不同是 **id ／ 層 ／ 要不要 `flex-direction: column`**。
   *
   * ⚠️ 為什麼還不是「跑一遍 `panelsFor(profile)`」：那四格的**建構**與各自的
   *    相依糾纏在一起（Blockly 要 registry、程式碼走 `profile.createCodeView`、
   *    下方面板要 tabs）。這一步先把**格子**收掉，建構留在原地——
   *
   * > **一次抽象如果同時搬走「容器」與「內容」，它壞掉時你分不出是哪一半。**
   */
  const makeCell = (id: string, layer: UnderstandingLayer, column = true): HTMLDivElement => {
    const el = document.createElement('div')
    el.id = id
    el.style.gridArea = layer
    if (column) { el.style.display = 'flex'; el.style.flexDirection = 'column' }
    el.style.minWidth = '0'
    el.style.minHeight = '0'
    el.style.overflow = 'hidden'
    return el
  }

  const blocksColumn = makeCell('blocks-column', 'space')
  main.appendChild(blocksColumn)

  // 🔴 一顆控制項都不剩的話**不建這條列**——一條空的列只是把版面吃掉。
  const quickAccessNeeded = panelControls(surfaces)
    .filter((c) => surfaceOf(c, surfaces) === 'panelToolbar')
    .some((c) => c.bar === 'quickAccess')
  const quickAccessBar = quickAccessNeeded
    ? new QuickAccessBar(blocksColumn, { inPanel: inToolbar })
    : null

  const blocklyContainer = document.createElement('div')
  blocklyContainer.id = 'blockly-panel'
  blocklyContainer.style.flex = '1'
  blocklyContainer.style.overflow = 'hidden'
  blocksColumn.appendChild(blocklyContainer)

  // 🔴 **`media` 不傳的話，Blockly 會去 `blockly-demo.appspot.com` 抓圖示與音效**
  // ——而離線時那些圖示會壞掉，壞得很安靜（只是變破圖，功能還在）。
  // ⚠️ 這個選項**本來就接好了**（`BlocklyPanel` 的 `media?`），只是從來沒有人傳。
  // 檔案由 `vite.config.ts` 從 `node_modules/blockly/media` 複製，
  // 由第四十五條護欄（`e2e/offline.spec.ts`）守著。
  const blocklyPanel = new BlocklyPanel({
    container: blocklyContainer,
    blockSpecRegistry,
    // 🔴 **透傳，不知道它是誰**（spec 153）——組裝點（`app.ts`）給的。
    buildProgramRoot: languageWiring?.buildProgramRoot as never,
    installExtractStrategies: languageWiring?.installExtractStrategies as never,
    // ⚠️ **環境差異**：網頁版從 base URL 取，而把應用嵌進別的宿主時
    //    檔案在別的地方。🔴 而它不是「要不要有」——兩邊都要有。
    media: (window as unknown as { __SEMORPHE_BLOCKLY_MEDIA__?: string })
      .__SEMORPHE_BLOCKLY_MEDIA__ ?? `${import.meta.env.BASE_URL}blockly-media/`,
  })
  blocklyPanel.init(toolbox)

  // Right panel: Monaco + BottomPanel
  // 🔴 沒有切的時候它是一個**沒掛進 DOM 的容器**——程式碼視圖的建構子
  //    仍然收得到一個容器（那本來就是契約：「即使那個實作不在上面畫任何東西」）。
  const codeColumn = makeCell('code-column', 'element')
  codeColumn.classList.add('code-column')
  main.appendChild(codeColumn)

  const monacoWrapper = document.createElement('div')
  monacoWrapper.className = 'monaco-wrapper'
  monacoWrapper.id = 'monaco-panel'
  // 🔴 這一格若不存在，就**不佔版面**——不是藏起來，是不撐開。
  //    ⚠️ 而容器本身仍然要建：程式碼視圖的建構子收得到它
  //       （即使那個實作不在上面畫任何東西）。
  if (!profile.features.codeEditorPane) {
    monacoWrapper.style.flex = '0 0 0'
    monacoWrapper.style.height = '0'
    monacoWrapper.style.overflow = 'hidden'
  }
  codeColumn.appendChild(monacoWrapper)

  // 🔴 **由宿主決定這一格是誰**——這個檔不認識任何一個具體的編輯器。
  const codeView = profile.createCodeView(monacoWrapper)

  // 🔴 **下方面板是一個容器，它的存在取決於裡面有沒有東西**。
  //
  // ⚠️ 主控台去了終端機、變數去了 `panel` 區之後，IDE 那側它是**空的**
  //    ——而一條空的分頁列仍然吃掉高度。與快速列同一條規則：不建。
  //
  // > **一個沒有內容的容器不是「比較小的容器」，它是純粹的浪費。**
  const bottomTabs = CONTROLS.filter((c) => (c.id === 'console' || c.id === 'variables'))
    .filter((c) => surfaceOf(c, surfaces) === 'panelBottom')
  // 🔴 **主控台是 grid 的一格（`state`），不再掛在程式碼那一欄底下**（spec 168）。
  //    版面可以**搬**它（十字時在右下），但**不得關掉**它——第八十一條的 I4 盯著。
  // ⚠️ **不是 column flex**——它裡面是 `BottomPanel` 自己的分頁 ＋ 內容。
  /**
   * 🔴 **主控台不是編輯區的一格**（spec 171，2026-09-02）。
   *
   * 使用者：「讓最底下水平**完全展開**是放主控台（不同於現在沒有完全展開），
   * 像是 VSCode 那樣，然後其他面板就在上面分割畫面」。
   *
   * ⚠️ 而理由不只是好看：**它不是一種投影，是執行的輸出**
   * （三維錨定——執行追蹤屬於情境。`history/198`）。
   * 它待在編輯區的那段期間，「十字要兩列」這個需求才存在，
   * 而那個需求是 Theia 排不出版面的唯一原因。
   *
   * > **一個分類如果只改標籤而不改任何決定，它還沒有付出代價。**
   *
   * 🟢 而搬出 grid 之後，`BottomPanel` 自己那條 divider 與高度比例
   * **自己就回來了**——它們一直在，只是被 `inGrid()` 收著。
   */
  const bottomContainer = document.createElement('div')
  bottomContainer.id = 'bottom-container'
  bottomContainer.style.minWidth = '0'
  bottomContainer.style.overflow = 'hidden'


  /**
   * 把底條掛在 `#editors` 的**後面**——`#app` 是直向 flex，所以它自然全寬。
   *
   * ⚠️ 狀態列在它之後：要 `insertBefore`，不是 `appendChild`。
   */
  //
  // 🪦 **「這個視窗畫不畫它」那一句 2026-09-02 當天就退場了**（同一支 spec）。
  //
  //    第一版在這裡問 `profile.layers.includes('state')`——因為主控台搬出 grid
  //    之後沒有人再拿掉它（實測：VSCode 的積木與流程視窗各自長出一條主控台）。
  //
  // 🟢 而正確的答案在**上面那一段**：`bottomTabs` 問的是 `controlSurfaces`，
  //    而積木／流程那兩種視窗的 `output`／`inspector` 投影到 `hostPanel`
  //    ——它們不畫，只把資料送過去。於是這裡一個判斷都不需要。
  //
  // > **一個「要不要畫」的問題如果需要新的判斷，
  // > 通常是既有的那份宣告還沒有說實話。**
  const mountBottom = (): void => {
    const bar = document.getElementById('status-bar')
    if (bar?.parentElement === appEl) appEl.insertBefore(bottomContainer, bar)
    else appEl.appendChild(bottomContainer)
  }
  /**
   * 🔴 **這個視窗有沒有編輯區**（2026-09-02，spec 171 第二刀）。
   *
   * IDE 的 panel 區裡，主控台／變數那兩個視圖**只有那一層**——整個 webview
   * 就是那一條。第一版沒有問這件事，於是 `#editors` 空著佔了 585px
   * （使用者截圖：分頁列被擠在最底下，上面一大片空白）。
   */
  const soloBottom = !!profile.layers && !profile.layers.some((l) => l !== 'state')
  let bottomPanel = bottomTabs.length > 0 ? new BottomPanel(bottomContainer) : null
  if (bottomPanel) {
    mountBottom()
    if (soloBottom) {
      bottomPanel.setSolo(true)
      // ⚠️ 編輯區整個不畫——它在這個視窗裡不是「空的」，是**不存在**。
      main.style.display = 'none'
    }
  }

  // 🔴 **主控台那一格建不建，問登錄表**（`controlSurfaces.output`）。
  //
  // ⚠️ 而 `ConsolePanel` **本身照建**：它是執行的輸出／輸入端點，
  //    宿主那側的終端機是它的鏡射。
  //
  // > **「不畫那一格」與「沒有主控台」是兩件事；
  // > 把它們寫成同一件，會讓執行在那個宿主上直接沒有出口。**
  const consoleEl = document.createElement('div')
  const consolePanel = new ConsolePanel(consoleEl)
  // 🔴 **主控台知道自己開不開**（spec 171）——而「有輸出就自己回來」那條規則
  //    住在 `ConsolePanel` 的寫入路徑上，不是各宿主各寫一份。
  //    ⚠️ 沒有下方面板的宿主給 `null`：那時它沒有可關的主控台，
  //       `revealForOutput` 什麼都不做。
  consolePanel.setSurface(bottomPanel?.asConsoleSurface() ?? null)
  /**
   * 把主控台那一格加進下方面板。
   *
   * 🔴 **它可以晚一點才發生**——`controlSurfaces.output` 說的是
   * 「這個宿主**應該**有終端機」，而某些宿主**實際上**打不開它
   *（Arduino IDE，2026-08-25 使用者實測）。那時主控台要還回來。
   *
   * ⚠️ 而重複呼叫是安全的：加過就不再加。
   */
  let consoleTabAdded = false
  let onBottomPanelCreated: ((panel: BottomPanel) => void) | null = null
  const enableConsoleTab = (): void => {
    if (consoleTabAdded) return
    consoleTabAdded = true
    // ⚠️ 這條列可能根本沒建（主控台與變數都去了宿主）——**現在需要它了**。
    //    🔴 那不是「早知道就建」：直到探測失敗之前，不建是對的。
    if (!bottomPanel) {
      bottomPanel = new BottomPanel(bottomContainer)
      // 🔴 **沒有切版面時，程式碼那一欄沒掛進 DOM**——掛過去會看不見。
      //    ⚠️ 那時它跟在積木下面（`main` 本身就是直向的 flex）。
      mountBottom()
      // 🔴 **執行控制器手上是建構當時的那一份**——不通知它的話，
      //    `showTab('console')` 會打在一個 `null` 上，而輸出看起來像沒有跑。
      onBottomPanelCreated?.(bottomPanel)
    }
    bottomPanel?.addTab({
      id: 'console',
      label: Blockly.Msg['PANEL_CONSOLE'] || 'Console',
      panel: consoleEl,
      actions: [
        { icon: '📋', title: '複製輸出', onClick: () => consolePanel.copyOutput() },
        { icon: Blockly.Msg['PANEL_CLEAR'] || '清除', title: 'Clear', onClick: () => consolePanel.clear() },
      ],
    })
  }
  if (surfaceOf(CONTROLS.find((c) => c.id === 'console')!, surfaces) === 'panelBottom') {
    enableConsoleTab()
  }

  // 🔴 **變數那一格建不建，也問登錄表**（`controlSurfaces.inspector`）。
  //    IDE 那側它住在 `panel` 區、與終端機同一排——**不是積木面板裡的一格**。
  //    使用者 2026-08-25：「我要的是放在主控台跟終端機一起」。
  const variableEl = document.createElement('div')
  const variablePanel = new VariablePanel(variableEl)
  if (surfaceOf(CONTROLS.find((c) => c.id === 'variables')!, surfaces) === 'panelBottom') {
    bottomPanel?.addTab({ id: 'variables', label: Blockly.Msg['PANEL_VARIABLES'] || 'Variables', panel: variableEl })
  }

  // 🔴 **第三個投影**。它出現在這裡只是因為要有一格 DOM——
  //    接線由 `registerViewsIn` 掃出來（見下面的回傳物件），不是這裡硬接的。
  //
  // ⚠️ 2026-08-25 它**搬出下方面板**（`draft/版面與檔案` §六之五）：
  //    流程是**關係層**，與積木（空間層）同級——兩者都是程式本身的投影、
  //    都需要面積、都可編輯。而主控台與變數是**狀態層**。
  //
  // > **把關係層塞進狀態層那一格，等於宣稱「流程是執行的產物」
  // > ——而它不是。**
  const flowEl = document.createElement('div')
  flowEl.id = 'flow-panel'
  flowEl.style.flex = '1'
  // ⚠️ 面板本身不捲——捲的是它裡面的 `.flow-canvas`（見 `flow-panel.ts`）。
  //    這裡留 `hidden` 是為了讓那一層自己決定，而不是讓兩層各捲各的。
  flowEl.style.overflow = 'hidden'
  // ⚠️ **不預設藏起來**——grid 之下藏不藏由 `flowColumn` 決定（見 `applyLayout`）
  const flowPanel = new FlowPanel(flowEl, blockSpecRegistry)
  /**
   * **兩個投影自己一列**（2026-08-26）。
   *
   * 🔴 「三欄」要讓流程與積木**並排**，而第一版直接把 `blocksColumn`
   * 的 `flexDirection` 改成 `row`——**那一欄裡還有工具列與分頁列**，
   * 於是它們也跟著橫排，畫面當場壞掉。
   *
   * > **一個容器如果裝著「內容」與「操作內容的東西」，
   * > 改它的排列方向會把兩者一起轉過去。**
   *
   * → 給內容一個自己的容器，方向改在那上面。
   */
  // 🪦 `projectionRow` 退場（2026-08-31）：它存在的理由是「三欄時讓流程與積木並排，
  //    而不動到工具列」——而 grid 之下**流程本來就是自己的一格**，不需要那層容器。
  //
  // 🔴 而那正是使用者感覺到的不對稱的所在：流程住在積木那一欄裡，
  //    於是它與積木**互斥**，而程式碼不必跟任何人互斥。
  const flowColumn = makeCell('flow-column', 'relation')
  flowEl.style.display = ''
  main.appendChild(flowColumn)
  flowColumn.appendChild(flowEl)

  /**
   * editor 區現在顯示哪一個投影。
   *
   * 🔴 **切換而不是並排**：這一欄只有一格。要並排的人**用宿主的 split**
   * ——那是 §六 的分工：「VSCode 那側的佈局工作幾乎是零，
   * 積木／流程是編輯器分頁，split 是原生的」。
   *
   * ⚠️ 切回積木時要**叫 Blockly 重新量尺寸**：它在 `display: none` 期間
   * 量到的是 0×0，而那個症狀是「切回去之後畫布空白，拖一下才出現」。
   */
  /** 現在「專注」顯示哪一層——`areas` 裡的 `'*'` 用它代換。 */
  // 🔴 **起始焦點必須是這個視窗真的有的層**（2026-09-01）。寫死 `'space'` 的話，
  //    一個只畫流程的視窗會把「專注」解析成「專注在積木上」——而積木不在那裡。
  let focusLayer: UnderstandingLayer =
    profile.layers && !profile.layers.includes('space') ? profile.layers[0] : 'space'
  /** 使用者把哪一層放在哪一格——**一張置換表**，見 `core/host/slot-assignment.ts`。 */
  let assignment: SlotAssignment = identityAssignment()
  let relayoutDividers: (() => void) | null = null
  let applyLayoutRef: ((id: LayoutPresetId) => void) | null = null

  /**
   * **一個槽的視圖選擇器**——四個槽共用**同一份產生器**。
   *
   * 🔴 使用者 2026-09-01：「我希望**每個面板可以去選擇要哪一種視圖**」，
   * 隨後「**我希望不是用 tab，而是用下拉式**」。
   *
   * 🟢 **下拉比分頁省的是寬度**：四層的分頁列在一個窄槽裡（十字每格約 300px）
   * 會佔掉整條，而下拉只佔一顆。⚠️ 而它讀起來也比較準：
   * 那一顆說的是「**這一格現在是什麼**」，分頁列說的是「有這些可選」。
   *
   * ⚠️ 用既有的 `showQuickPick`——開關、鍵盤、篩選、點外面關掉都在裡面了。
   * 🔴 另外做一個「小下拉」等於把那些**再實作一次**，而這個專案記過那個教訓。
   *
   * 🟢 而「每個槽的選項一樣」由**共用同一份產生器**保證——結構，不是規範。
   * 點一顆 ＝「把 X 放到**我這裡**」，而那是一次**對調**（`swapTo`）：
   * 原本顯示 X 的那一格會接手我現在這一層。
   */
  const buildSlotPicker = (own: UnderstandingLayer): HTMLElement => {
    const btn = document.createElement('button')
    btn.className = 'slot-picker'
    btn.addEventListener('click', () => {
      showQuickPick(
        {
          title: msg('SLOT_PICK', '這一格顯示'),
          // ⚠️ 選項來自**同一份**來源，每個槽逐字相同（spec 169 的 SC-002）
          // 🔴 **扣掉 `state`**（2026-09-02，spec 171）：主控台不是編輯區的一格
          //    ——它是底下那條獨立的、開得關得的底條。列它進來的話，選到它
          //    等於把「執行的輸出」塞回一欄投影裡，而那正是這一刀拆掉的形狀。
          items: LAYER_ORDER.filter((l) => l !== 'state' && layerAvailable(l)).map((l) => ({
            value: l,
            label: msg(`LAYER_${l.toUpperCase()}`, l),
            // 🔴 「目前」是**這個面板自己**——每個面板永遠顯示它自己，
            //    置換搬的是它的**位子**，不是它的內容。
            description: l === own ? msg('CURRENT', '目前') : undefined,
          })),
        },
        (v: string[] | null) => {
          const to = v?.[0] as UnderstandingLayer | undefined
          if (!to || to === own) return
          // 「把 X 放到**我這個位子**」——而我現在在的位子顯示的是我自己
          assignment = swapTo(assignment, own, to)
          applyLayoutRef?.(document.body.getAttribute('data-layout') as LayoutPresetId ?? 'compare')
        },
      )
    })
    return btn
  }

  const showProjection = (which: 'blocks' | 'flow'): void => {
    // 🔴 **「專注」顯示哪一層由這裡決定**（2026-08-31）——宣告寫的是 `'*'`，
    //    而 `'*'` 要被代換成使用者現在看的那一層。少了這兩行，「專注」永遠是程式碼。
    const target: UnderstandingLayer = which === 'blocks' ? 'space' : 'relation'
    focusLayer = target
    // 🔴 **它現在走的是同一張置換表**（2026-09-01）：宿主那顆「看積木／看流程」
    //    與槽上的下拉**做同一件事**，所以不會有兩份狀態。
    //    ⚠️ 而在此之前它寫一個獨立的 `projectionWanted`，於是兩邊會打架。
    const flat = effectiveAreas(
      layoutPreset(document.body.getAttribute('data-layout') as LayoutPresetId ?? 'compare')
        ?? LAYOUT_PRESETS[0], assignment, focusLayer).flat()
    if (!flat.includes(target)) {
      const shown = (['space', 'relation'] as const).find((l) => flat.includes(l))
      if (shown) assignment = swapTo(assignment, shown, target)
    }
    // 🔴 **grid 之下「哪一個投影看得到」由【版面】決定，不由這裡**（2026-08-31）。
    //
    //    在此之前這裡直接藏 `blocklyContainer`／`flowEl`——那是「兩個投影擠在同一欄、
    //    所以要互斥」的遺產，而**那個互斥正是使用者說的那個不對稱**：
    //
    //    > 「你現在把積木和流程用 tab 切換我不太喜歡，
    //    >  **因為這樣程式碼面板就變得比較特別了**」
    //
    //    ⚠️ 留著它的話「三欄」與「十字」會**兩個投影都不見一個**——
    //    而那不會報錯，畫面上就是空的。
    //
    // 🟢 它今天只剩一件事：告訴「專注」該顯示哪一層。
    // 🔴 **這個版面沒有那一層的話，把它【換進來】**（2026-08-31）。
    //
    //    ⚠️ 舊的做法是「兩個投影擠在同一欄、互斥」——而那正是使用者說的不對稱。
    //    新的做法一樣讓那顆按鈕有用，但它換的是**版面裡的那一格**，
    //    而不是「積木與流程共用一個位子」：三欄與十字兩個都在，這顆按鈕就不動任何東西。
    applyLayoutRef?.(document.body.getAttribute('data-layout') as LayoutPresetId ?? 'compare')
    if (which === 'blocks') requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }

  /**
   * **套一個佈局預設**（2026-08-26，路線圖「版面」那一項的活驗收）。
   *
   * 🔴 **它讀的是「哪幾層」，不是「哪幾個面板」**（`core/host/layout-presets.ts`）：
   * 加一個面板時這裡一個字都不用改——面板自己宣告它在哪一層。
   *
   * ```
   * 專注    一次一層          程式碼收起來，編輯區只留現在看的那一個投影
   * 對照    element ＋ space  程式碼 ＋ 積木並排——**取用要相鄰**
   * 三欄    再加上 relation   流程也攤開——**認識要面積**
   * ```
   *
   * ⚠️ `state`（主控台／變數）**不受它影響**：它的家是下方的面板區，
   * 三個預設都一樣。第八十一條護欄的硬性零盯著這一點。
   *
   * ⚠️ **不做自由 docking**（路線圖明文排除）：這是一個教學工具，
   * 老師說「看左邊那一欄」時那句話要對每個人都成立。
   */

  /**
   * 這一層在這個宿主上**存不存在**。
   *
   * 🔴 不存在的層，它的軌道收成 `0`——而不是「畫出來再藏起來」。
   * ⚠️ 判準問的是**能力**（`profile.features` ／ 有沒有那個面板），不是宿主的名字。
   */
  const layerAvailable = (l: UnderstandingLayer): boolean =>
    // 🔴 **宿主指名了哪幾層的話，那是硬邊界**（2026-09-01）——一個只畫流程的
    //    視窗裡，積木不是「藏起來」，是**不在那裡**。
    profile.layers && !profile.layers.includes(l) ? false
      : l === 'element' ? profile.features.codeEditorPane
        : l === 'state' ? bottomPanel !== null
          : true

  /**
   * 四個槽各一顆選擇器，**同一份產生器產的**（spec 169 的 SC-002）。
   *
   * 🔴 **併進那一格【既有的】工具列，不自己多一列**（使用者 2026-09-01：
   * 「然後我不想換行」——與行動版那條「**只能有一列工具列**」同一條規矩）。
   *
   * ⚠️ 而那條列**不保證在這一刻就存在**（流程工具列與下方分頁列是面板自己建的），
   * 所以掛載要**可以重跑**：`applyLayout` 每次都確認一遍。
   *
   * > **一條「等它出現再掛」的邏輯，寫成「掛一次」就會在它比較晚出現的那天失效。**
   */
  /**
   * **四格的那一張表**（spec 170 · T017／T019）。
   *
   * 🔴 它取代了兩個各自列四次的地方：`SLOT_BARS` 與 `applyLayout` 的四行
   *    display。⚠️ 而「`state` 畫出來時是 `''` 不是 `'flex'`」這個例外
   *    現在**寫在表裡**，不是藏在其中一行後面。
   *
   * > **一個只在四行裡的其中一行成立的例外，讀的人會以為那三行也一樣。**
   */
  const CELLS = [
    { el: codeColumn, layer: 'element' as const, bar: '.monaco-clipboard-bar', shownAs: 'flex' },
    { el: flowColumn, layer: 'relation' as const, bar: '.flow-toolbar', shownAs: 'flex' },
    { el: blocksColumn, layer: 'space' as const, bar: '.quick-access-bar', shownAs: 'flex' },
    // 🪦 主控台那一列退場（spec 171）——它不是編輯區的一格了。
    //    ⚠️ 它的那條頭仍然存在（`.bottom-panel-tabs`），只是不再由這張表管
    //       它的顯示／隱藏——那是 `BottomPanel` 自己的事。
  ]
  const slotPickers = new Map(CELLS.map(({ layer }) => [layer, buildSlotPicker(layer)]))
  const mountSlotPickers = (): void => {
    for (const { el, layer, bar } of CELLS) {
      const btn = slotPickers.get(layer)!
      // 🔴 **沒有那條列就替它開一條**，而不是把按鈕丟進這一格（2026-09-01）。
      //
      //    VSCode 把控制項全投影到宿主，於是快速列**不建**。舊寫法退回 `el`
      //    ——按鈕成了 column flex 的直接子節點，**撐滿整欄、字置中**，
      //    看起來像浮在半空的標籤。使用者：「好像面板不是真的面板，
      //    而是大家被塞在一起」。
      //
      // > **一個「找不到家就先放這裡」的退路，會在那個家【永遠不會出現】的
      // > 宿主上變成常態——而它從來沒有被當成常態設計過。**
      //
      // ⚠️ 那條列**晚一點才建**時要讓位：真的工具列一出現就搬回去，
      //    而空的 `.panel-head` 自己收掉。
      const real = el.querySelector(bar)
      let host = real
      if (!host) {
        const own = el.querySelector<HTMLElement>(':scope > .panel-head')
        // 🔴 走同一支產生器（spec 170 · T012）——這裡曾經是第五份手寫的頭。
        host = own ?? el.insertBefore(createPanelHead().el, el.firstChild)
      }
      if (btn.parentElement !== host) host.insertBefore(btn, host.firstChild)
      if (real) {
        const stale = el.querySelector<HTMLElement>(':scope > .panel-head')
        if (stale && stale.childElementCount === 0) stale.remove()
      }
    }
  }

  applyLayoutRef = (id: LayoutPresetId): void => {
    // 🔴 **這個宿主鋪不出來的版面，換成它鋪得出來的第一張**（2026-09-01）。
    //
    //    開機寫死套「對照」，而在一個只畫流程的視窗裡它一層都不含——
    //    縮減之後是空矩陣，`areas[0].map` 直接炸，**面板一片空白**。
    //
    // > **一個「預設值」如果是寫死的，它就假設了所有宿主都長得一樣。**
    const usable = hostLayoutOptions(layerAvailable, focusLayer)
    const preset = layoutPreset(usable.some((o) => o.id === id) ? id : usable[0]?.id ?? id)
    if (!preset) return
    // 🔴 **使用者的指派套在這裡**（2026-09-01，spec 169）：宣告是**預設**，
    //    而 `assignment` 是一張層與層的置換表。⚠️ 它只換名字不換形狀——
    //    格數、跨度、`state` 必在都保住（第九十九條的 A2 盯著）。
    let areas = effectiveAreas(preset, assignment, focusLayer).map((r) => [...r])
    // 🪦 **「版面只放得下一個投影時，放使用者最後按的那一個」那段退場**
    //    （2026-09-01，spec 169）。
    //
    // 🔴 它是「兩個投影擠同一欄、所以互斥」那個時代的補償。而槽自己選視圖之後
    //    它會**安靜地抵銷**使用者的選擇：`effectiveAreas` 剛把那一格換成流程，
    //    它下一行就依 `projectionWanted`（還停在 `space`）換回積木。
    //    使用者：「我選了另外的，好像行為有點怪」——畫面沒動，只有下拉的字變了。
    //
    // > **一段為了舊機制而存在的補償，在新機制上線之後會安靜地抵銷它
    // > ——而它不會報錯，因為它做的正是它當初被寫下來要做的事。**

    // 一整欄（列）都是「這個宿主沒有的層」→ **整條拿掉**。
    //
    // 🪦 之前是「軌道收成 `0px`」。而一條 0px 的軌道**不是不存在**：
    //    它兩側各留一條 gap，於是在容器邊緣後面多出一條**假的縫**。
    //    使用者 2026-09-01 在 VSCode：「**這拉不動**」——畫面上唯一那條線
    //    hover 會變藍而按下去沒反應，因為把手的序號被那條假縫錯開了一格
    //    （根因與另一半的修在 `layout/grid-dividers.ts` 的 `boundaryAt`）。
    //
    // > **「寬度是零」不等於「不在那裡」——一個佔不到面積的東西，
    // > 仍然佔著【序號】與【它兩側的縫】。**
    //
    // 🪦 **2026-09-02（spec 171）：「拿掉整列」那一半也退場了。**
    //    主控台搬去底下之後，編輯區**只有一列**——沒有任何一列可以拿掉。
    const keepCol = areas[0].map((_, c) => layerAvailable(areas[0][c]))
    areas = [areas[0].filter((_, i) => keepCol[i])]

    main.style.gridTemplateAreas = `"${areas[0].join(' ')}"`
    main.style.gridTemplateColumns = areas[0].map(() => '1fr').join(' ')
    main.style.gridTemplateRows = '1fr'

    // 沒有出現在這張版面裡的層 → 那一格不畫（grid 不會替它留位子）
    // 🔴 **要還原成 `flex`，不是 `''`**（2026-08-31 實測）。三欄都是直向的 flex 容器
    //    （工具列在上、內容在下），而 `''` 會把它清成 `block`——於是裡面那個
    //    `flex: 1` 的內容量到 **0 高**，畫面上是一片空白而**沒有任何錯誤**。
    //
    // > **把 inline 樣式清成空字串，還的不是「原本的值」，是「沒有值」。**
    // 🔴 **一行，不是四行**（spec 170 · T017）——四格跑同一份 `CELLS`。
    //    ⚠️ 而 `state` 那一格的「畫出來」是 `''` 不是 `'flex'`（它裡面是
    //       `BottomPanel` 自己的分頁 ＋ 內容，不是直向的 flex）——
    //       那個差別跟著 `CELLS` 走，不再是四行裡藏著的一個例外。
    const shown = new Set(areas.flat())
    for (const c of CELLS) {
      c.el.style.display = shown.has(c.layer) && layerAvailable(c.layer) ? c.shownAs : 'none'
    }

    // ⚠️ 每次都重掛一遍——那條列可能是這一刻之後才建出來的
    mountSlotPickers()
    // 🔴 每一顆選擇器寫的是**它所在的那個面板是誰**——而那永遠是它自己。
    //
    //    ⚠️ 第一版寫成 `assignment[layer]`（「這一格宣告的層被換成了誰」），
    //    於是流程面板上的那顆會寫著「積木」——**標籤與它腳下的東西相反**。
    //
    // > **置換搬的是面板的【位子】，不是它的【內容】
    // > ——所以標籤問的是「我是誰」，不是「我這一格原本叫什麼」。**
    for (const { layer } of CELLS) {
      const btn = slotPickers.get(layer)!
      btn.dataset.layer = layer
      btn.textContent = `${msg(`LAYER_${layer.toUpperCase()}`, layer)} ▾`
      btn.title = btn.textContent
    }

    document.body.setAttribute('data-layout', id)
    // 🔴 **重鋪把手要【先排】，而且不能跟別人共用一個 callback**（2026-09-01 實測）。
    //
    //    第一版把它寫在 `requestAnimationFrame` 裡、**排在 `dispatchEvent(resize)`
    //    後面**——而那一行只要有任何一個 resize 監聽者丟例外，**後面就不會執行**。
    //    症狀：切了版面，把手還停在上一個版面的座標上，而 console 一句話都沒有。
    //
    // > **兩件事排在同一個 callback 裡，前面那件失敗會把後面那件一起帶走
    // > ——而它們之間可能一點關係都沒有。**
    //
    // ⚠️ 用 macrotask 而不是 rAF：把手的位置要問 `getBoundingClientRect()`，
    //    而那要等**版面算完**。rAF 只保證「下一次繪製之前」，實測連兩層都不夠。
    setTimeout(() => relayoutDividers?.(), 0)
    // ⚠️ Blockly／流程圖在 `display: none` 期間量到的是 0×0——要叫它們重量一次
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }

  // 🔴 **開機就要套一次**（2026-08-31）。grid 之下「什麼都不套」不是「預設版面」，
  //    是**一張沒有 `grid-template-areas` 的 grid**——四格會全部疊在左上角。
  //
  // ⚠️ 以前不用套是因為 flex 的初始樣式**剛好長得像「對照」**。
  //
  // > **一個「不做任何事就是對的」的預設，換掉底層之後會變成「什麼都沒有」，
  // > 而它不會報錯。**

  /**
   * 🚚 **↩↪ 搬到全域標頭**（2026-09-01，spec 169）。
   *
   * 🔴 `doUndo` 早就問 `lastEditor` 走三條路（程式碼／流程／積木）
   * ——**行為是全域的，而它的位置在積木那一欄的快速列裡**。
   *
   * > **一個動作如果對三個視圖都成立，它就不該住在其中一個視圖裡。**
   *
   * 🟢 而這條原則**行動版早就寫著了**（見 `adoptActionBarSections`：
   * 「↩↪ 排在最前面，而且不跟著快速列進積木那一格」）——桌機是那個例外。
   *
   * ⚠️ **只搬桌機**：行動版試過把它塞進標頭，使用者在 390px 的真手機上回報
   * 「標頭被擠爆了」。**同一個位置在兩個寬度下不是同一個決定。**
   */
  const headerActionsEl = toolbar?.querySelector('.toolbar-actions')
  const undoSlotEl = document.getElementById('undo-slot')
  if (headerActionsEl && undoSlotEl) headerActionsEl.insertBefore(undoSlotEl, headerActionsEl.firstChild)

  const applyLayout = applyLayoutRef
  applyLayout('compare')
  relayoutDividers = installGridDividers(main)

  /**
   * 🔴 **還原／重做在行動版要搬家，而不是複製一對。**
   *
   * 使用者 2026-08-31：「手機沒有每個視圖都顯示還原按鈕」。實測
   * （`e2e/mobile-undo-everywhere.spec.ts`）：
   *
   * ```
   * 程式碼分頁  ↩↪ 0x0      ← 看不到
   * 積木分頁    ↩↪ 27x22    ✅
   * 流程分頁    ↩↪ 0x0      ← 看不到
   * ```
   *
   * 原因：`switchToMobile` 把**整條快速列**搬進 `mobileBlocksContainer`，
   * 而 ↩↪ 是它的一員——於是「還原」被關進了積木那一格。
   *
   * > **一顆全域的按鈕，住在一個會被分頁藏起來的容器裡，
   * > 就只是那個分頁的按鈕。**
   *
   * ⚠️ 而處置**不能是「在別的分頁再放一對」**：使用者 2026-08-30 才要求
   * 把三對還原鈕合併成一對。**搬的是同一組 DOM 節點**，所以處理器、狀態、
   * 路由（`doUndo` 依 `lastEditor` 決定）全都不變。
   *
   * 🟢 它本來就是全域的：還原動的是**語義樹**，不是某一個投影。
   *
   * 🔴 **搬回去靠的是插槽，不是記兄弟節點**——見 `quick-access-bar.ts`
   * 裡 `#undo-slot` 那段（第一版記兄弟，而兩顆互相參照，還原時必然丟
   * `NotFoundError`，症狀是「兩顆都沒回來」）。
   */
  // Mobile layout: create mobile containers and tab bar
  // These are created once but only shown when in mobile mode
  const mobileBlocksContainer = document.createElement('div')
  mobileBlocksContainer.className = 'mobile-panel-container'
  mobileBlocksContainer.id = 'mobile-blocks'
  main.appendChild(mobileBlocksContainer)

  const mobileCodeContainer = document.createElement('div')
  mobileCodeContainer.className = 'mobile-panel-container'
  mobileCodeContainer.id = 'mobile-code'
  main.appendChild(mobileCodeContainer)

  const mobileConsoleContainer = document.createElement('div')
  mobileConsoleContainer.className = 'mobile-panel-container'
  mobileConsoleContainer.id = 'mobile-console'
  main.appendChild(mobileConsoleContainer)

  // 🔴 **關係層有自己的一格**（2026-08-25）——在此之前行動版只有三個分頁，
  //    而流程從來沒有進來過（它住在下方面板裡）。見 `mobile-tab-bar.ts` 的 `TABS`。
  const mobileFlowContainer = document.createElement('div')
  mobileFlowContainer.className = 'mobile-panel-container'
  mobileFlowContainer.id = 'mobile-flow'
  main.appendChild(mobileFlowContainer)

  // 行動版的分頁列。
  //
  // 🔴 **`mobileLayout: false` 的宿主【不建它】** ——而那不只是美觀問題：
  // 網頁版靠 CSS 的寬度斷點切換版面，而**一塊面板天生就窄**
  // ——於是桌面的 IDE 裡會冒出手機的分頁列。
  //
  // ⚠️ 2026-08-18 使用者實測撞到：面板下方出現「積木／程式碼／主控台」，
  //    而 `features.mobileLayout` 明明宣告了 `false`
  //    ——**因為那個宣告從來沒有人消費**。
  //
  // > **一個宣告了而沒有人讀的能力旗標，與一個不存在的旗標，效果一樣
  // > ——差別只在前者看起來已經處理過了。**
  // 🔴 **CSS 那一半也要關掉。** 版面有兩半：這個檔（誰看得見）與
  // `style.css` 的 `@media (max-width: 768px)`（絕對定位、藏掉分隔線）。
  // 只關 JS 那一半，得到的是**半套行動版**——`.split-left` 被絕對定位蓋住，
  // 而沒有人來切換它的可見性，**積木畫布在 DOM 裡存在卻看不見**。
  document.body.classList.toggle('host-no-mobile-layout', !profile.features.mobileLayout)

  let mobileTabBar: MobileTabBar | null = null
  let tabBarContainer: HTMLElement | null = null
  if (profile.features.mobileLayout) {
    tabBarContainer = document.createElement('div')
    tabBarContainer.id = 'mobile-tab-bar-container'
    tabBarContainer.style.display = 'none'
    appEl.appendChild(tabBarContainer)
    mobileTabBar = new MobileTabBar(tabBarContainer)
  }

  // ─── Virtual Keyboards (touch devices) ───

  // 虛擬鍵盤——⚠️ 它要操作底層編輯器，而不是每個宿主都交得出來。
  const codeKeyboard = profile.features.codeKeyboard
    ? new CodeKeyboard(mobileCodeContainer)
    : null
  codeKeyboard?.setEditor(codeView.getEditor?.() as never)

  const consoleKeyboard = profile.features.codeKeyboard
    ? new CodeKeyboard(mobileConsoleContainer)
    : null

  // IME toggle buttons
  const createImeToggle = (parent: HTMLElement) => {
    const btn = document.createElement('button')
    btn.className = 'ime-toggle-btn'
    btn.textContent = '⌨'
    btn.title = '切換回程式鍵盤'
    btn.style.display = 'none'
    parent.appendChild(btn)
    return btn
  }
  const imeToggleBtn = createImeToggle(mobileCodeContainer)
  const consoleImeToggleBtn = createImeToggle(mobileConsoleContainer)
  // Desktop-touch IME toggle (lives in codeColumn)
  const desktopImeToggleBtn = createImeToggle(codeColumn)

  // Suppress native keyboard on a target element
  const suppressNativeKB = (el: HTMLElement | null) => {
    if (el) el.setAttribute('inputmode', 'none')
  }
  const restoreNativeKB = (el: HTMLElement | null) => {
    if (el) el.removeAttribute('inputmode')
  }
  const getMonacoTextarea = () =>
    monacoWrapper.querySelector('.monaco-editor .inputarea') as HTMLTextAreaElement | null

  // ── Code keyboard show/hide helpers ──

  const showCodeKeyboard = () => {
    codeKeyboard?.show()
    imeToggleBtn.style.display = 'none'
    desktopImeToggleBtn.style.display = 'none'
    suppressNativeKB(getMonacoTextarea())
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const showNativeIME = () => {
    codeKeyboard?.hide()
    // Show the appropriate toggle button
    if (layoutManager.getMode() === 'mobile') {
      imeToggleBtn.style.display = ''
    } else {
      desktopImeToggleBtn.style.display = ''
    }
    const textarea = getMonacoTextarea()
    restoreNativeKB(textarea)
    textarea?.focus()
    // ⚠️ 這個宿主可能沒有底層編輯器可以聚焦——`?.` 不是防禦，是「它本來就可能不存在」。
    const editor = codeView.getEditor?.() as { focus?: () => void } | null | undefined
    editor?.focus?.()
  }

  codeKeyboard?.onNativeIME(() => showNativeIME())
  codeKeyboard?.onCollapse(() => {
    // Show IME toggle so user can bring keyboard back
    imeToggleBtn.style.display = ''
    desktopImeToggleBtn.style.display = ''
  })
  imeToggleBtn.addEventListener('click', () => showCodeKeyboard())
  desktopImeToggleBtn.addEventListener('click', () => showCodeKeyboard())

  // ── Console keyboard show/hide helpers ──

  const showConsoleKeyboard = () => {
    const input = consolePanel.getInlineInput()
    if (!input) return
    consoleKeyboard?.show()
    consoleImeToggleBtn.style.display = 'none'
    suppressNativeKB(input)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const showConsoleNativeIME = () => {
    consoleKeyboard?.hide()
    consoleImeToggleBtn.style.display = ''
    const input = consolePanel.getInlineInput()
    if (input) {
      restoreNativeKB(input)
      input.focus()
    }
  }

  consoleKeyboard?.onNativeIME(() => showConsoleNativeIME())
  consoleKeyboard?.onCollapse(() => {
    consoleImeToggleBtn.style.display = ''
  })
  consoleImeToggleBtn.addEventListener('click', () => showConsoleKeyboard())

  // ── Console input ↔ virtual keyboard wiring ──

  consolePanel.onInputShow((input) => {
    if (!layoutManager.isTouchDevice()) return
    if (layoutManager.getMode() === 'mobile') {
      // Mobile: use dedicated console keyboard
      suppressNativeKB(input)
      consoleKeyboard?.attachInput(input, () => consolePanel.submitCurrentInput())
      consoleKeyboard?.show()
    } else {
      // Desktop-touch: reuse codeKeyboard, switch to input mode
      suppressNativeKB(input)
      codeKeyboard?.attachInput(input, () => consolePanel.submitCurrentInput())
      // Keyboard is already visible; just switch target
    }
  })
  consolePanel.onInputHide(() => {
    if (layoutManager.getMode() === 'mobile') {
      consoleKeyboard?.detachInput()
      consoleKeyboard?.hide()
      consoleImeToggleBtn.style.display = 'none'
    } else {
      // Desktop-touch: revert codeKeyboard back to Monaco mode
      codeKeyboard?.detachInput()
    }
  })

  // Create mobile menu
  const hamburgerBtn = document.getElementById('hamburger-btn')
  // 🪦 `MobileMenu` 已於 2026-08-25 刪除。
  //
  // 它是「從工具列往下掉的覆蓋選單」——而點一列又跳出底部的 QuickPick。
  //
  // > **一次操作裡換兩種介面，使用者要重新找一次「按哪裡」。**
  //
  // 現在兩層都是同一張 QuickPick（`layout/status-bar-controls.ts` 的 `openSettings`）。
  // ⚠️ 接線在 `setupToolbarButtons`（與其餘按鈕同一處）——**不要第二個接線處**。
  void hamburgerBtn

  // 🪦 `selectorMounts` / `selectorOriginalParents` 已於 2026-08-25 刪除。
  //
  // 那是「桌機的下拉搬進漢堡選單、再搬回來」的機制——而行動版現在讀
  // **同一份 `ControlState`**（`layout/status-bar-controls.ts` 的 `renderSheetControls`），
  // 於是沒有東西需要搬。
  //
  // > **行動版不是「桌機版縮小」，是同一份宣告的第三個渲染器。**

  // Panel DOM references for mobile switching
  const switchToMobile = () => {
    // 🔴 **這個宿主沒有行動版版面就【整段不跑】。**
    //
    // ⚠️ 網頁版靠 CSS 的寬度斷點切版面，而**一塊面板天生就窄**
    // ——桌面 IDE 裡因此會冒出手機的分頁列（2026-08-18 使用者實測撞到）。
    //
    // 而處置是**提前返回**，不是逐行加 `?.`：
    // > **一段「不該執行」的程式，讓它安全地執行完，
    // > 與讓它不執行，是兩件事——而前者會留下半套狀態。**
    if (!profile.features.mobileLayout) return
    // Move blockly panel elements to mobile container
    // 四個投影的工具列 ＋ 全域的 ↩↪ 合成一列——見 `ACTION_BAR_SECTIONS`
    adoptActionBarSections()
    mobileBlocksContainer.appendChild(blocklyContainer)
    mobileBlocksContainer.classList.add('active')

    // Move monaco to mobile container (keyboard must stay below)
    mobileCodeContainer.insertBefore(monacoWrapper, codeKeyboard?.getElement() ?? null)
    mobileCodeContainer.classList.remove('active')

    // Move console/variable (bottom panel) to mobile container (keyboard must stay below)
    if (bottomPanel) mobileConsoleContainer.insertBefore(bottomContainer, consoleKeyboard?.getElement() ?? null)
    mobileConsoleContainer.classList.remove('active')

    // 🔴 流程有自己的一格——⚠️ 而它在桌機是**同一欄裡的另一個投影**，
    //    在行動版是**另一個分頁**：搬過去之後 `display` 要放開，
    //    因為顯示與否改由分頁的 `.active` 決定。
    mobileFlowContainer.appendChild(flowEl)
    flowEl.style.display = ''
    mobileFlowContainer.classList.remove('active')

    // 🪦 「把選擇器搬進漢堡選單」那段已刪除——行動版的設定表由
    //    `renderSheetControls` 依 `ControlState` 直接畫（2026-08-25）。
    // Show tab bar
    if (tabBarContainer) tabBarContainer.style.display = ''

    // Show mobile sync button
    const mobileSyncBtn = document.getElementById('mobile-sync-btn')
    if (mobileSyncBtn) mobileSyncBtn.style.display = ''

    // Add toolbox collapse button
    let collapseBtn = document.getElementById('toolbox-collapse-btn')
    if (!collapseBtn) {
      collapseBtn = document.createElement('button')
      collapseBtn.id = 'toolbox-collapse-btn'
      collapseBtn.className = 'toolbox-collapse-btn'
      collapseBtn.textContent = '◀'
      const positionCollapseBtn = () => {
        const toolbox = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
        if (!toolbox || !collapseBtn) return
        const isHidden = toolbox.style.display === 'none'
        collapseBtn.style.left = isHidden ? '0px' : `${toolbox.getBoundingClientRect().width}px`
      }
      collapseBtn.addEventListener('click', () => {
        const toolbox = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
        if (!toolbox) return
        const isHidden = toolbox.style.display === 'none'
        toolbox.style.display = isHidden ? '' : 'none'
        collapseBtn!.textContent = isHidden ? '◀' : '▶'
        window.dispatchEvent(new Event('resize'))
        requestAnimationFrame(positionCollapseBtn)
      })
      mobileBlocksContainer.appendChild(collapseBtn)
      // Position after Blockly renders
      requestAnimationFrame(positionCollapseBtn)
      // Keep position in sync when toolbox resizes (e.g. category expand/collapse)
      const toolboxEl = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
      if (toolboxEl) {
        new ResizeObserver(() => requestAnimationFrame(positionCollapseBtn)).observe(toolboxEl)
      }
      // Hide collapse button when toolbox flyout is open, show when closed
      const flyoutEl = blocklyContainer.querySelector('.blocklyToolboxFlyout') as SVGElement | null
      if (flyoutEl) {
        new MutationObserver(() => {
          const flyoutVisible = getComputedStyle(flyoutEl).display !== 'none'
          collapseBtn!.style.visibility = flyoutVisible ? 'hidden' : 'visible'
        }).observe(flyoutEl, { attributes: true, attributeFilter: ['style', 'display'] })
      }
    }
    collapseBtn.style.display = ''

    // Activate the current tab
    const activeTab = mobileTabBar!.getActiveTab()
    activateMobilePanel(activeTab)

    // Hide desktop layout elements
    blocksColumn.style.display = 'none'
    codeColumn.style.display = 'none'

    // Apply mobile-friendly Monaco options (reduce IME issues)
    codeView.applyMobileOptions?.()

    // Move keyboards to mobile containers
    if (codeKeyboard) mobileCodeContainer.insertBefore(codeKeyboard.getElement(), imeToggleBtn)
    if (consoleKeyboard) mobileConsoleContainer.insertBefore(consoleKeyboard.getElement(), consoleImeToggleBtn)

    // Show code keyboard if code tab is active
    if (mobileTabBar!.getActiveTab() === 'code') {
      showCodeKeyboard()
    }

    window.dispatchEvent(new Event('resize'))
  }

  const switchToDesktop = () => {
    // 同上——沒有行動版就沒有「切回桌面版」這件事。
    if (!profile.features.mobileLayout) return
    // Move panels back to desktop containers (order matters: monaco before bottomPanel)
    if (quickAccessBar) {
      const qa = quickAccessBar.getElement()
      qa.style.display = ''   // ⚠️ 行動版依分頁藏過它，桌面版一定要放開
      blocksColumn.appendChild(qa)
    }
    /**
     * 其餘三段各自回家。
     *
     * 🔴 **每一段都是插在容器的最前面，而不是 `appendChild`**——它們原本都是
     * 第一個子節點（工具列在內容上面）。⚠️ 唯一的例外是主控台那一條：
     * 它上面還有一條可拖曳的分隔線，所以錨點是**內容區**，不是 `firstChild`。
     *
     * ⚠️ `display` 一定要放開：行動版依分頁把不屬於當前投影的段落藏起來，
     *    而桌面版四段同時都要看得見。
     */
    const restoreSection = (sel: string, home: HTMLElement, anchor: Node | null): void => {
      const el = mobileActionBar.querySelector(sel)
      if (!(el instanceof HTMLElement)) return
      el.style.display = ''
      home.insertBefore(el, anchor)
    }
    restoreSection('.flow-toolbar', flowEl, flowEl.firstChild)
    restoreSection('.monaco-clipboard-bar', monacoWrapper, monacoWrapper.firstChild)
    restoreSection('.bottom-panel-tabs', bottomContainer, bottomContainer.querySelector('.bottom-panel-content'))
    bottomPanel?.setCollapsible(true)
    // ↩↪ 回到桌面版的原位——**照開機時記下的錨點放**，
    // ⚠️ 不用 `appendChild`：那會把它們排到「清空」後面，而順序是使用者記得的東西。
    // ↩↪ 回到那個從來沒離開過的插槽裡——見 `quick-access-bar.ts` 的 `#undo-slot`
    const undoSlot = document.getElementById('undo-slot')
    const grp = document.getElementById('undo-group')
    if (undoSlot && grp) undoSlot.appendChild(grp)
    mobileActionBar.style.display = 'none'
    blocksColumn.appendChild(blocklyContainer)
    // Ensure correct order: monaco first, then bottom panel
    codeColumn.appendChild(monacoWrapper)
    if (bottomPanel) mountBottom()
    // 🔴 流程回到**投影那一列**——⚠️ 不是回到 `blocksColumn`：
    //    2026-08-26 加了 `projectionRow`（讓三欄時兩個投影並排而不動到工具列），
    //    而這裡如果放回外層，**從手機切回桌機之後三欄就排不出來**
    //    ——症狀只在「轉過螢幕方向」之後出現，平常看不到。
    //
    //    > **一個「把東西放回去」的路徑，會在容器變深的那天放到錯的層。**
    flowColumn.appendChild(flowEl)
    showProjection('blocks')

    // 🪦 「把選擇器搬回工具列」那段已刪除——同上。

    // Hide mobile containers
    mobileBlocksContainer.classList.remove('active')
    mobileCodeContainer.classList.remove('active')
    mobileConsoleContainer.classList.remove('active')

    // Hide tab bar
    tabBarContainer!.style.display = 'none'

    // Hide mobile sync button
    const mobileSyncBtn = document.getElementById('mobile-sync-btn')
    if (mobileSyncBtn) mobileSyncBtn.style.display = 'none'

    // Hide toolbox collapse button and restore toolbox
    const collapseBtn = document.getElementById('toolbox-collapse-btn')
    if (collapseBtn) collapseBtn.style.display = 'none'
    const toolboxDiv = blocklyContainer.querySelector('.blocklyToolbox') as HTMLElement | null
    if (toolboxDiv) toolboxDiv.style.display = ''

    // Close mobile menu

    // Restore desktop layout
    blocksColumn.style.display = 'flex'
    codeColumn.style.display = ''

    // Restore desktop Monaco options
    codeView.applyDesktopOptions?.()

    // Clean up mobile keyboards
    consoleKeyboard?.detachInput()
    consoleKeyboard?.hide()
    imeToggleBtn.style.display = 'none'
    consoleImeToggleBtn.style.display = 'none'

    if (layoutManager.isTouchDevice()) {
      // Desktop-touch: move code keyboard to right column, show it
      codeColumn.insertBefore(codeKeyboard!.getElement(), desktopImeToggleBtn)
      codeKeyboard?.detachInput()
      showCodeKeyboard()
    } else {
      // Desktop without touch: hide everything
      codeKeyboard?.hide()
      desktopImeToggleBtn.style.display = 'none'
      restoreNativeKB(getMonacoTextarea())
    }

    window.dispatchEvent(new Event('resize'))
  }

  const activateMobilePanel = (tab: TabId) => {
    // 🔴 **一條工具列，內容跟著你在看哪個投影走。**
    //
    // ⚠️ 顯示的是「這個分頁原本就有的那一段」，不是全部一起出現：
    //    在程式碼分頁上出現「自動排版／縮放」是純粹的噪音，而它還會
    //    把這一列撐長到要橫捲——**整合成一列不等於把三列疊起來。**
    //
    // ⚠️ **每次切分頁都再收一次晚到的段落**——編輯器與主控台那兩條不保證
    //    在切版面的那一刻就存在（見 `adoptActionBarSections`）。
    adoptActionBarSections()
    // 🔴 分頁列搬走了，「再按一下收起來」也要跟著關——見 `setCollapsible`。
    //    ⚠️ 放在這裡而不是 `switchToMobile`：主控台那一格**可能晚一點才建**，
    //    而這裡每次切分頁都會再說一次。
    bottomPanel?.setCollapsible(false)
    for (const { sel, tab: owner } of ACTION_BAR_SECTIONS) {
      const el = mobileActionBar.querySelector(sel)
      if (el instanceof HTMLElement) el.style.display = owner === tab ? '' : 'none'
    }
    // 🔴 **主控台那一格不給還原鈕**（使用者 2026-08-31：「主控台那邊也不需要還原按鈕」）。
    //
    // 它是這一列上唯一「每個分頁都在」的段落，而**主控台不是一個投影**
    // ——那裡沒有東西可以還原：它顯示的是執行的輸出，不是程式本身。
    //
    // > **「全域」的意思是「每一個投影都在」，不是「每一個分頁都在」。**
    const undoGrp = document.getElementById('undo-group')
    if (undoGrp) undoGrp.style.display = tab === 'console' ? 'none' : ''
    mobileBlocksContainer.classList.toggle('active', tab === 'blocks')
    mobileCodeContainer.classList.toggle('active', tab === 'code')
    mobileConsoleContainer.classList.toggle('active', tab === 'console')
    mobileFlowContainer.classList.toggle('active', tab === 'flow')
    // Use requestAnimationFrame to ensure DOM is fully updated before resize
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }

  // Connect tab bar to panel switching
  //
  // 🔴 **用守衛，不用 `!`。** 我一度為了消掉型別錯誤把這裡寫成 `mobileTabBar!`
  // ——而預檢立刻炸：`Cannot read properties of null (reading 'onTabChange')`。
  //
  // > **機械地壓掉一個型別錯誤，是把它從編譯期搬到執行期。**
  mobileTabBar?.onTabChange((tab) => {
    activateMobilePanel(tab)
    // Show/hide code keyboard based on active tab
    if (tab === 'code') {
      showCodeKeyboard()
    } else {
      codeKeyboard?.hide()
      imeToggleBtn.style.display = 'none'
    }
  })

  // Handle mode changes
  layoutManager.onModeChange((mode) => {
    if (mode === 'mobile') {
      switchToMobile()
    } else {
      switchToDesktop()
    }
  })

  // Initial layout setup
  if (layoutManager.getMode() === 'mobile') {
    // Defer to after all initialization is complete
    requestAnimationFrame(() => switchToMobile())
  } else if (layoutManager.isTouchDevice()) {
    // Desktop-touch: show code keyboard in right column on initial load
    requestAnimationFrame(() => {
      codeColumn.insertBefore(codeKeyboard!.getElement(), desktopImeToggleBtn)
      showCodeKeyboard()
    })
  }

  // 🔴 **預設是積木**——⚠️ 而這一行同時把分頁的 active 樣式設對；
  //    少了它的症狀是「兩個分頁都不亮，而畫面上是積木」。
  showProjection('blocks')

  return { blocklyPanel, codeView, consolePanel, variablePanel, flowPanel, bottomPanel, quickAccessBar, layoutManager, mobileTabBar, codeKeyboard, showProjection, applyLayout, layoutOptions: () => hostLayoutOptions(layerAvailable, focusLayer), enableConsoleTab, onBottomPanelReady: (cb: (p: BottomPanel) => void) => { onBottomPanelCreated = cb } }
}

/*
 * 🪦 `setupSelectors` 已於 2026-08-25 刪除。
 *
 * 它建的是四顆 `<select>`（目標／風格／積木風格／語系）——而那四顆現在
 * 是**同一份 `ControlState` 的三個渲染器**：桌機狀態列、IDE 狀態列、
 * 行動版設定表。加一顆 picker 不再需要動任何一個渲染器。
 *
 * ⚠️ 而 `TopicSelector` 的層級樹彈出也一起退場——它變成 QuickPick 的
 * **多選 ＋ 全形空格縮排**。🔴 那是有損失的：勾選框的樹狀結構比一串
 * 縮排清楚。**而收益是「三個宿主同一個互動」**，這一筆交換是明的。
 */

export function setupToolbarButtons(
  callbacks: Pick<AppShellCallbacks, 'onOpenSyncMenu'> & {
    onAction: (id: ControlId) => void
    /** 行動版的設定清單。 */
    onOpenSettings: () => void
  },
): void {
  const replaceBtn = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const clone = el.cloneNode(true) as HTMLElement
      el.parentNode?.replaceChild(clone, el)
      return clone
    }
    return null
  }

  replaceBtn('sync-menu-btn')?.addEventListener('click', callbacks.onOpenSyncMenu)
  // 行動版的設定——⚠️ 它不是控制項登錄表的一員，是**行動版的 chrome**
  //（與分頁列同一類），所以在這裡具名接。
  replaceBtn('hamburger-btn')?.addEventListener('click', callbacks.onOpenSettings)
  for (const spec of CONTROLS) {
    if (spec.kind !== 'action' || spec.id === 'run') continue
    replaceBtn(spec.mountId)?.addEventListener('click', () => callbacks.onAction(spec.id))
  }

}

export function setupFileButtons(
  storageService: StorageLike,
  callbacks: Pick<AppShellCallbacks, 'getExportState' | 'importState' | 'onUploadCustomBlocks'>,
): void {
  // File dropdown menu toggle
  const fileMenuBtn = document.getElementById('file-menu-btn')
  const fileMenu = document.getElementById('file-menu')
  if (fileMenuBtn && fileMenu) {
    fileMenuBtn.addEventListener('click', () => {
      fileMenu.style.display = fileMenu.style.display === 'none' ? 'block' : 'none'
    })
    document.addEventListener('click', (e) => {
      if (!fileMenuBtn.contains(e.target as Node) && !fileMenu.contains(e.target as Node)) {
        fileMenu.style.display = 'none'
      }
    })
  }

  const closeMenu = () => { if (fileMenu) fileMenu.style.display = 'none' }

  document.getElementById('export-btn')?.addEventListener('click', () => {
    closeMenu()
    const state = callbacks.getExportState()
    const blob = storageService.exportToBlob!(state)
    storageService.downloadBlob!(blob, `semorphe-${Date.now()}.json`)
    showToast(Blockly.Msg['TOAST_EXPORT_SUCCESS'] || '已匯出', 'success')
  })

  document.getElementById('import-btn')?.addEventListener('click', () => {
    closeMenu()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const state = storageService.importFromJSON!(reader.result as string)
        if (!state) {
          showToast(Blockly.Msg['TOAST_IMPORT_ERROR'] || '匯入失敗：無效的 JSON', 'error')
          return
        }
        callbacks.importState(state)
        showToast(Blockly.Msg['TOAST_IMPORT_SUCCESS'] || '已匯入', 'success')
      }
      reader.readAsText(file)
    })
    input.click()
  })

  document.getElementById('upload-blocks-btn')?.addEventListener('click', () => {
    closeMenu()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const blocks = JSON.parse(reader.result as string)
          if (!Array.isArray(blocks)) {
            showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Invalid format: expected an array of block definitions', 'error')
            return
          }
          for (const blockDef of blocks) {
            if (!blockDef.type) {
              showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Invalid block: missing type', 'error')
              return
            }
          }
          callbacks.onUploadCustomBlocks(blocks)
        } catch {
          showToast(Blockly.Msg['TOAST_UPLOAD_ERROR'] || 'Failed to parse JSON file', 'error')
        }
      }
      reader.readAsText(file)
    })
    input.click()
  })
}

export function updateStatusBar(
  currentStylePreset: StylePreset,
  currentLocale: string,
  currentBlockStyleId: string,
  topicName: string,
  /** 🪦 `mobileMenu` 參數已於 2026-08-25 移除——那個選單退場了。 */
  /**
   * 目前語言的顯示名。
   *
   * 🔴 **原本這裡寫死 `'C++'`**——視圖層寫死一個語言的名字（P9 第一項）。
   * 症狀是切到 Python 之後狀態列仍然說「C++ | … | Python 入門」，
   * **而全套測試綠**：沒有任何一支在看那一行字。
   * > **一個只出現在狀態列的字串，只有截圖抓得到。**
   */
  languageName = 'C++',
  /**
   * 同步的三態。🔴 **它必須一直看得見**——
   * 一個沒被顯示的狀態，使用者會當成壞掉（開機誤報那一刀的同一條）。
   */
  sync?: { phase: 'live' | 'paused' | 'diverged'; source: string | null },
  /**
   * **目前目標的顯示名**——用來判斷語言那一格是不是廢話。
   *
   * 🔴 使用者 2026-08-27：「網頁版最右邊的 C++ 不能切換語言也很怪，感覺有點多餘」。
   *
   * ⚠️ 而它**只在某些情境下多餘**，因為 `FIELD_OWNERSHIP` 把兩者分在兩邊：
   *
   * ```
   * targetId  context   「我在教什麼」
   * language  document  「這個檔案是什麼語言」
   *
   * 目標 = C++（預設）  → 語言 C++     🔴 重複
   * 目標 = Arduino UNO  → 語言 C++     🟢 有資訊（Arduino 寫的是 C++）
   * 目標 = Python 入門  → 語言 Python  🟢 有資訊
   * ```
   *
   * > **一格資訊在一種情境下重複、在另一種情境下必要
   * > ——而它原本用同一種方式呈現兩者。**
   *
   * 判準是那條掃描判準的唯讀版：
   * > 選項：每一個留在畫面上的**選項**，都要說得出「誰有意見」。
   * > 資訊：每一個留在畫面上的**資訊**，都要說得出「它在什麼時候不是廢話」。
   *
   * ⚠️ 省略時**照畫**——不知道目標叫什麼的呼叫端（測試、裸的那條列）
   * 不該因此少一格資訊。
   */
  targetName?: string,
  /**
   * 回傳**扣掉三態的那一段**（語言｜風格｜積木風格｜主題｜語系）。
   *
   * 🔴 為什麼要回傳：不畫狀態列的宿主**仍然要拿得到這些字**
   * ——它們進宿主狀態列的 tooltip。
   * ⚠️ **「不畫」不等於「不算」**：一旦這裡提早 return，那些資訊就真的沒了。
   */
): string {
  const styleName = currentStylePreset.name[currentLocale] || currentStylePreset.name['zh-TW'] || currentStylePreset.id
  const blockStyleLabel = (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${currentBlockStyleId.toUpperCase()}`] || currentBlockStyleId
  const syncLabel = sync
    ? sync.phase === 'paused'
      ? `⏸ ${(Blockly.Msg as Record<string, string>)['SYNC_STATE_PAUSED'] || '已暫停'}`
      : sync.phase === 'diverged'
        ? `⚠️ ${(Blockly.Msg as Record<string, string>)['SYNC_STATE_DIVERGED'] || '兩邊都改了'}`
        : `⇄ ${(Blockly.Msg as Record<string, string>)['SYNC_STATE_LIVE'] || '同步中'}`
    : ''
  const syncText = syncLabel === '' ? '' : ` | ${syncLabel}`
  const contextText = `${languageName} | ${styleName} | ${blockStyleLabel} | ${topicName} | ${currentLocale}`
  const summaryText = `${contextText}${syncText}`

  /**
   * 目標的名字已經說出語言了嗎——說了就別再講一次。
   *
   * ⚠️ 比對用**寬鬆包含**而不是相等：目標叫「C++（預設）」而語言叫「C++」。
   * 🔴 而**大小寫與全形括號**都要吃得下，所以先正規化。
   */
  const saysLanguage = (target: string | undefined, lang: string): boolean => {
    if (!target) return false
    const norm = (t: string): string => t.toLowerCase().replace(/[\s（）()［］\[\]]/g, '')
    return norm(target).includes(norm(lang))
  }
  const languageCell = saysLanguage(targetName, languageName) ? '' : languageName

  // 🔴 **不得覆寫整條列**——picker 就掛在它裡面（2026-08-25 起）。
  //
  // > **一個用 `innerHTML =` 更新文字的地方，
  // > 在那塊區域長出第二個東西的那一天，會安靜地把它清掉。**
  const summarySlot = document.getElementById('status-summary')
  const syncBtn = document.getElementById('sync-menu-btn')
  if (summarySlot) {
    // 有 picker 的那條列：語言與三態**不是 picker**，所以只留這兩格；
    // 其餘那幾格已經是列上的控制項了，再寫一次就是講兩次。
    summarySlot.textContent = languageCell
    // ⚠️ 三態寫進**那顆按鈕**——它同時是顯示處與入口，與 VSCode 那側同形。
    if (syncBtn) syncBtn.textContent = syncLabel
    else summarySlot.textContent = `${languageCell}${syncText}`
  } else {
    // ⚠️ 沒有 `#status-summary` ＝ 舊的／裸的那條列（測試會這樣建）。
    const statusBar = document.getElementById('status-bar')
    if (statusBar) statusBar.innerHTML = `<span>${summaryText}</span>`
  }

  // 🪦 行動版的摘要那一行已刪除——它把五顆控制項各講了一次，
  //    而那五顆就在同一張清單裡。
  //
  // > **一段重複旁邊那份資料的摘要，只會比它先過期。**

  return contextText
}
