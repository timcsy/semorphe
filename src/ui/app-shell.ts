import * as Blockly from 'blockly'
import { SplitPane } from './layout/split-pane'
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
import { layoutPreset, type LayoutPresetId } from '../core/host/layout-presets'
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

  const headerActions = [
    inToolbar('style') ? '<span id="style-selector-mount"></span>' : '',
    inToolbar('locale') ? '<span id="locale-selector-mount"></span>' : '',
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
  const bottomTabsExist = CONTROLS
    .filter((c) => c.id === 'console' || c.id === 'variables')
    .some((c) => surfaceOf(c, surfaces) === 'panelBottom')
  const codeSideHasContent = profile.features.codeEditorPane || bottomTabsExist

  // 方向由「有沒有程式碼那一格」決定：有＝左右分、沒有＝上下分。
  // 🔴 而**兩邊都要有東西才切**——否則不切。
  const splitPane = codeSideHasContent
    ? new SplitPane(main, profile.features.codeEditorPane ? 'horizontal' : 'vertical')
    : null

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
  const blocksColumn = splitPane ? splitPane.getRightPanel() : main
  blocksColumn.style.display = 'flex'
  blocksColumn.style.flexDirection = 'column' 

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
  const codeColumn = splitPane ? splitPane.getLeftPanel() : document.createElement('div')
  codeColumn.classList.add('code-column')

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
  const bottomContainer = document.createElement('div')
  let bottomPanel = bottomTabs.length > 0 ? new BottomPanel(bottomContainer) : null
  if (bottomPanel) codeColumn.appendChild(bottomContainer)

  // 🔴 **主控台那一格建不建，問登錄表**（`controlSurfaces.output`）。
  //
  // ⚠️ 而 `ConsolePanel` **本身照建**：它是執行的輸出／輸入端點，
  //    宿主那側的終端機是它的鏡射。
  //
  // > **「不畫那一格」與「沒有主控台」是兩件事；
  // > 把它們寫成同一件，會讓執行在那個宿主上直接沒有出口。**
  const consoleEl = document.createElement('div')
  const consolePanel = new ConsolePanel(consoleEl)
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
      ;(codeSideHasContent ? codeColumn : blocksColumn).appendChild(bottomContainer)
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
  flowEl.style.display = 'none'
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
  const projectionRow = document.createElement('div')
  projectionRow.id = 'projection-row'
  projectionRow.style.flex = '1'
  projectionRow.style.display = 'flex'
  projectionRow.style.flexDirection = 'column'
  projectionRow.style.minHeight = '0'
  projectionRow.style.overflow = 'hidden'
  blocksColumn.insertBefore(projectionRow, blocklyContainer)
  projectionRow.appendChild(blocklyContainer)
  projectionRow.appendChild(flowEl)

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
  const showProjection = (which: 'blocks' | 'flow'): void => {
    blocklyContainer.style.display = which === 'blocks' ? '' : 'none'
    flowEl.style.display = which === 'flow' ? '' : 'none'
    document.getElementById('view-blocks-btn')?.classList.toggle('active', which === 'blocks')
    document.getElementById('view-flow-btn')?.classList.toggle('active', which === 'flow')
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
  const applyLayout = (id: LayoutPresetId): void => {
    const preset = layoutPreset(id)
    if (!preset) return
    const wants = (l: UnderstandingLayer): boolean => preset.layers.includes(l)
    if (id === 'focus') {
      // 一次一層：程式碼收起來，編輯區**回到單欄**並維持現在看的那一個投影。
      //
      // 🔴 第一版只收了程式碼那一欄——**而兩個投影還並排著**（實測），
      //    於是「專注」變成「三欄少一欄」。
      //    > **「一次一層」不是「少給一層」，是【回到一層】。**
      codeColumn.style.display = 'none'
      splitPane?.setDividerVisible?.(false)
      // ⚠️ **那一欄要把整個寬度吃掉**——`SplitPane` 給的是固定比例，
      //    收起左欄之後右欄還是原本那一半，畫面右邊留一大片空白（實測）。
      blocksColumn.style.flex = '1'
      blocksColumn.style.width = '100%'
      projectionRow.style.flexDirection = 'column'
      // 哪一個投影留下來由使用者現在看的那顆分頁決定——這裡不挑。
      const flowActive = flowEl.style.display !== 'none' && blocklyContainer.style.display === 'none'
      showProjection(flowActive ? 'flow' : 'blocks')
    } else {
      codeColumn.style.display = wants('element') ? '' : 'none'
      splitPane?.setDividerVisible?.(wants('element'))
      // 還原「專注」動過的寬度——⚠️ 不還原的話從專注切回來右欄會吃掉整個畫面。
      //
      // 🔴 **而寬度要交還給 `SplitPane`，不是清成空字串**（2026-08-27 實測）：
      //    `blocksColumn` 就是 `splitPane.getRightPanel()`，那個 inline 寬度
      //    （`calc(50% - 2px)`）是它設的。清掉之後那一欄退回 `flex: 0 1 auto`，
      //    **縮成內容寬度**——2000px 的視窗裡積木欄只剩 213px，右邊一大片黑。
      //
      //    > **兩個地方寫同一個 inline 樣式，後寫的那個不知道自己在覆蓋一份狀態。**
      //
      // ⚠️ 而它的症狀**不會出現在切換的當下**，只在「進過專注（或三欄）再切回來」
      //    那條路上——所以單開一個版面預設看起來都是對的。
      blocksColumn.style.flex = ''
      blocksColumn.style.width = ''
      splitPane?.refresh?.()
      // 三欄：流程與積木**並排**，而不是互斥
      const both = wants('relation') && wants('space')
      projectionRow.style.flexDirection = both ? 'row' : 'column'
      blocklyContainer.style.display = wants('space') ? '' : 'none'
      flowEl.style.display = wants('relation') ? '' : 'none'
    }
    document.body.setAttribute('data-layout', id)
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }

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
    if (quickAccessBar) mobileBlocksContainer.appendChild(quickAccessBar.getElement())
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
    if (quickAccessBar) blocksColumn.appendChild(quickAccessBar.getElement())
    // ⚠️ **那一列自己也要回到欄裡、而且排在工具列之後**——
    //    `appendChild` 一個已經在別處的節點會把它搬過來，順序就是呼叫順序。
    blocksColumn.appendChild(projectionRow)
    projectionRow.appendChild(blocklyContainer)   // 放回【投影那一列】，不是外層
    // Ensure correct order: monaco first, then bottom panel
    codeColumn.appendChild(monacoWrapper)
    if (bottomPanel) codeColumn.appendChild(bottomContainer)
    // 🔴 流程回到**投影那一列**——⚠️ 不是回到 `blocksColumn`：
    //    2026-08-26 加了 `projectionRow`（讓三欄時兩個投影並排而不動到工具列），
    //    而這裡如果放回外層，**從手機切回桌機之後三欄就排不出來**
    //    ——症狀只在「轉過螢幕方向」之後出現，平常看不到。
    //
    //    > **一個「把東西放回去」的路徑，會在容器變深的那天放到錯的層。**
    projectionRow.appendChild(flowEl)
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

  return { blocklyPanel, codeView, consolePanel, variablePanel, flowPanel, bottomPanel, quickAccessBar, layoutManager, mobileTabBar, codeKeyboard, showProjection, applyLayout, enableConsoleTab, onBottomPanelReady: (cb: (p: BottomPanel) => void) => { onBottomPanelCreated = cb } }
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

  // 🔴 **不得覆寫整條列**——picker 就掛在它裡面（2026-08-25 起）。
  //
  // > **一個用 `innerHTML =` 更新文字的地方，
  // > 在那塊區域長出第二個東西的那一天，會安靜地把它清掉。**
  const summarySlot = document.getElementById('status-summary')
  const syncBtn = document.getElementById('sync-menu-btn')
  if (summarySlot) {
    // 有 picker 的那條列：語言與三態**不是 picker**，所以只留這兩格；
    // 其餘那幾格已經是列上的控制項了，再寫一次就是講兩次。
    summarySlot.textContent = languageName
    // ⚠️ 三態寫進**那顆按鈕**——它同時是顯示處與入口，與 VSCode 那側同形。
    if (syncBtn) syncBtn.textContent = syncLabel
    else summarySlot.textContent = `${languageName}${syncText}`
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
