/**
 * **控制項登錄表** —— 這個應用有哪些控制項，以及它們投影到哪個表面。
 *
 * ## 為什麼是登錄表，不是第六格布林
 *
 * 使用者 2026-08-25：
 *
 * > 「**Style、語言等等我想要不放在現在這邊，因為放在現在這邊會進積木面板，
 * > 這樣在 VSCode 不是很好**」
 *
 * 直覺的做法是給 `HostFeatures` 再加四格布林。⚠️ 而那條路會爆炸：
 * 今天已經五格（`fileButtons`／`mobileLayout`／`codeKeyboard`／
 * `codeEditorPane`／`statusBar`），再搬四顆就是九格——
 * **而它們講的是同一件事**：
 *
 * > **這顆控制項，在這個宿主投影到哪裡。**
 *
 * 🔴 這就是「唯一真實，各式投影」用在 chrome 自己身上。
 * 所以：**控制項宣告自己是什麼，宿主宣告每一種投影到哪個表面**。
 * 加一顆控制項 ＝ 登錄表加一列，**不是每個宿主各加一格布林**。
 *
 * ## 分類的判準是「使用者拿它做什麼」，不是「它長什麼樣」
 *
 * ```
 * picker      選一個值        → 宿主的狀態列（VSCode 自己的語言／編碼就是這樣放的）
 * action      做一件事        → 宿主的分頁標題列
 * indicator   看一個狀態      → 宿主的狀態列（點得下去，但主要是給人看的）
 * output      程式在講話      → 宿主的終端機
 * inspector   執行時看的東西  → 宿主的面板區（終端機旁邊那一排）
 * ```
 *
 * ## ⚠️ `output` 與 `inspector` 為什麼是兩種
 *
 * 它們在網頁版是同一格（下方面板），**而在 IDE 不是**：
 * 程式的輸出屬於終端機，而變數屬於 `panel` 區的一個視圖。
 * 🔴 表面由 `kind` 決定，所以「兩個東西的宿主表面不同」＝**它們是兩種**。
 *
 * ## 🔴 `output` 為什麼是終端機，不是 Output 面板
 *
 * **我們的程式會讀輸入**（`cin`）。而 VSCode 的 Output channel 是唯讀的：
 *
 * > **一個唯讀的輸出格會讓「輸入」沒有家
 * > ——而那正是主控台今天存在的理由。**
 *
 * ⚠️ 而 `domain` 是**另一個軸**，它不決定表面，它回答「為什麼不該待在積木面板」：
 * 一顆 `session` 的控制項（這個檔案用什麼語言）**跟積木沒有關係**，
 * 它待在積木面板裡只是歷史。
 */

/** 使用者拿它做什麼——🔴 **表面由這一格決定**。 */
export type ControlKind = 'picker' | 'action' | 'indicator' | 'output' | 'inspector'

/**
 * 它管的範圍。⚠️ **不決定表面**——它是「為什麼不該待在積木面板」的理由。
 */
export type ControlDomain = 'session' | 'view' | 'project'

/**
 * 投影到哪裡。
 *
 * ⚠️ `panelToolbar`／`panelStatusBar` ＝ **我們自己畫**；
 * `host*` ＝ **宿主畫**，而那背一個義務：宿主那側要真的接手
 * （由 `tests/integration/audit-status-bar-owner.test.ts` 對釘）。
 */
export type ControlSurface =
  | 'panelToolbar'
  | 'panelStatusBar'
  | 'panelBottom'
  | 'hostStatusBar'
  | 'hostTitleBar'
  | 'hostTerminal'
  | 'hostPanel'

export type ControlId =
  | 'target' | 'track' | 'lesson' | 'template' | 'scaffold' | 'style' | 'blockStyle' | 'locale'   // 🪦 `branches` 於 2026-08-28 退場（見下面的墓碑）
  | 'run' | 'undo' | 'redo' | 'clear'
  | 'viewBlocks' | 'viewFlow'
  | 'layout'
  | 'sync'
  | 'console'
  | 'variables'

export interface ControlSpec {
  readonly id: ControlId
  readonly kind: ControlKind
  readonly domain: ControlDomain
  /** 面板裡的掛載點 id。⚠️ 投影到宿主時**這一格不會被用到**。 */
  readonly mountId: string
  /** 面板工具列上的哪一條。 */
  readonly bar: 'header' | 'quickAccess'
  /**
   * 投影到宿主時的標題（指令面板看得到的那一行）。
   *
   * ⚠️ 面板裡那顆的文字**不讀這一格**——它讀 `Blockly.Msg`（會跟著語系換）。
   * 🔴 而宿主的指令標題**在載入擴充時就固定了**，換不了；
   * 兩者長得像而生命週期不同，所以是兩格，不是一格。
   */
  readonly hostTitle: string
  /** 標題列上的圖示（codicon）。⚠️ `action` 才有意義。 */
  readonly icon?: string
}

/**
 * 🔴 **完整清單**——測試拿它逐一比對，宿主拿它決定要建什麼。
 *
 * ⚠️ `sync` 在這裡是 `indicator` 而不是 `action`：使用者主要是**看**它
 * （同步中／已暫停／兩邊都改了），點下去只是順便。
 * 它 2026-08-25 已經投影到宿主狀態列了——**這一列是把既成事實補進登錄表**，
 * 不是新功能。
 */
export const CONTROLS: readonly ControlSpec[] = [
  { id: 'target', kind: 'picker', domain: 'session', mountId: 'level-selector-mount', bar: 'quickAccess', hostTitle: '選擇目標（語言／板子）' },
  // 🔴 **課程與章節是兩顆**（2026-08-28 使用者：「課程可以再拆分成課程和章節」）。
  //
  // ```
  // 目標   語言／板子   C++ · C · Python · Arduino Uno · ESP32…
  // 課程   軌道         C++ 入門 · C++ 進階 · Python 入門 · Arduino 專題…
  // 章節   課           01 印出一句話 · 02 記住資料…
  // ```
  //
  // 一顆的時候「C++ 進階」只能待在**目標**選單裡，而它其實是一條軌道
  // ——拆開之後目標就只剩語言與板子（「目標可以更單純一些」）。
  //
  // ⚠️ 兩顆都**不會**被課釘住（`controlsPinnedBy` 回空）——它們是出口。
  { id: 'track', kind: 'picker', domain: 'session', mountId: 'track-selector-mount', bar: 'quickAccess', hostTitle: '選擇課程' },
  { id: 'lesson', kind: 'picker', domain: 'session', mountId: 'lesson-selector-mount', bar: 'quickAccess', hostTitle: '選擇章節' },
  // 🔴 **範例**——沒選課程時佔「章節」那一格。
  //
  // 形狀抄 **Arduino IDE 的 Examples 選單**（使用者 2026-08-28：
  // 「這就很像是 ArduinoIDE 提供的那種範例」）：分組、完整可跑、拿去改。
  //
  // ⚠️ 它與章節**不會同時出現**——那一格問的是同一件事
  // （「我從什麼開始」），只是有課的時候由課回答。
  { id: 'template', kind: 'picker', domain: 'session', mountId: 'template-selector-mount', bar: 'quickAccess', hostTitle: '選擇範例' },
  // 🔴 **鷹架**——它有兩個軸，而那兩個軸是同一顆 picker 的兩個群組：
  //
  // ```
  // 外框   哪幾段組成程式的框架     ← 被【目標的語言】限制有哪些選擇
  // 顯示   隱藏 / 淡的 / 完整       ← 三個一律可選
  // ```
  //
  // 使用者 2026-08-28：「你可以再加一個目前是用哪一種 scaffold 的狀態嗎？
  // 然後使用者也可以選，**這也會被你選什麼目標限制有哪些選擇**」。
  //
  // ⚠️ 在此之前它**完全沒有使用者入口**——只有課程設得了它，
  //    而沒選課程的人拿到的是一個他看不見也改不了的預設。
  { id: 'scaffold', kind: 'picker', domain: 'session', mountId: 'scaffold-selector-mount', bar: 'quickAccess', hostTitle: '鷹架' },
  // 🪦 **`branches`（選擇教學層級）已於 2026-08-28 退場。**
  //
  // 它是六個控制項裡唯一一個**連老師都答不出來**的
  // ——`draft/教案是一個宣告` 拿「每一個留在畫面上的選項，都要說得出誰有意見」
  // 掃過那六格，只有這一格的答案是「🔴 沒有人有意見」。
  //
  // 使用者 2026-08-12 的原話早就否證過它：
  // > 「我會乾脆叫學生把全部都打勾，**那有沒有這個漸進揭露是沒用的**」
  //
  // 🎯 **它被「選一堂課」取代，而不是被「選得更好」**（`?lesson=`，2026-08-28）。
  // 而在取代品存在之前它不能退——所以它等了 65 堂課。
  //
  // ⚠️ **`enabledBranches` 這個機制本身沒有退場**：它仍然是可見集合的載體，
  //    只是現在**永遠全開**，收窄由課的 `components` 做。
  //    整套退場要動存檔（`context` 歸屬）與 VSCode 設定，那是另一刀。
  // 🪦 **`style` picker 已於 2026-08-27 退場——它已經由目標決定。**
  //
  // 使用者：「程式風格現在先跟目標合併好了，先選目標再選課程」。
  // 而查證下來**那個合併早就做完了**：`Target` 宣告 `style`（`types.ts:873`），
  // 13 個目標全部填了，而 `handleTargetChange` 切目標時就會 `applyStylePreset`。
  // `storage-version.test.ts:72` 的註解逐字寫著意圖：
  // 「**目標取代了『課程清單 ＋ 風格』兩次分開的選擇**」。
  //
  // 🔴 沒收尾的地方就是這一列，而它的症狀不是「多一顆按鈕」：
  //
  // ```
  // 選 arduino-uno  → style 自動變 google
  // 手動改 style     → 目標仍然說它該是 google
  //                    → 兩個東西不一致，而【那個狀態沒有名字】
  // ```
  //
  // > **一個宣告了預設值、而又留著一顆手動選單的欄位，
  // > 會產生「宣告說 A、實際是 B」的狀態——而它沒有名字。**
  //
  // 🟢 **退場不失去能力**：5 個風格，每一個都有目標指到它
  // （apcs→cpp · c→c · competitive→cpp-advanced · google→arduino* · python→python）。
  // ⚠️ 而 `onStyleChange` 那條線**留著**——切目標時仍然要套用那個目標的風格。
  { id: 'blockStyle', kind: 'picker', domain: 'session', mountId: 'block-style-selector-mount', bar: 'quickAccess', hostTitle: '選擇積木風格' },
  { id: 'locale', kind: 'picker', domain: 'session', mountId: 'locale-selector-mount', bar: 'header', hostTitle: '選擇介面語言' },
  { id: 'run', kind: 'action', domain: 'project', mountId: 'run-btn', bar: 'header', hostTitle: '執行', icon: '$(play)' },
  { id: 'undo', kind: 'action', domain: 'view', mountId: 'undo-btn', bar: 'quickAccess', hostTitle: '復原', icon: '$(discard)' },
  { id: 'redo', kind: 'action', domain: 'view', mountId: 'redo-btn', bar: 'quickAccess', hostTitle: '重做', icon: '$(redo)' },
  { id: 'clear', kind: 'action', domain: 'view', mountId: 'clear-btn', bar: 'quickAccess', hostTitle: '清空積木', icon: '$(clear-all)' },
  // 🔴 **切換 editor 區顯示哪一個投影**（2026-08-25，`draft/版面與檔案` §六之五）。
  //
  // 流程原本是**下方面板的一個分頁**，與主控台、變數並排——而那是狀態層。
  //
  // > **把關係層塞進狀態層那一格，等於宣稱「流程是執行的產物」
  // > ——而它不是，它是程式的另一個投影。**
  //
  // ⚠️ 它們是 `action` 不是 `picker`：picker 投影到狀態列（工作階段的設定），
  //    而「現在看哪一個」是**這個視圖的動作**，它的家是分頁的標題列。
  { id: 'viewBlocks', kind: 'action', domain: 'view', mountId: 'view-blocks-btn', bar: 'quickAccess', hostTitle: '顯示積木', icon: '$(symbol-structure)' },
  { id: 'viewFlow', kind: 'action', domain: 'view', mountId: 'view-flow-btn', bar: 'quickAccess', hostTitle: '顯示流程', icon: '$(type-hierarchy)' },
  // 🔴 **桌機的佈局預設**（2026-08-26，`vision` 的「版面」那一項）。
  //
  // ⚠️ 它是 `picker` 而**不是三顆 action**：三顆按鈕會讓「現在是哪一種」
  // 變成一件要靠 `active` 樣式去讀的事，而它是一個**工作階段的設定**
  // ——與風格、層級同一族。
  //
  // ⚠️ `domain: 'view'` 而不是 `'session'`：換一個檔案不該換掉版面，
  // 而換一個**宿主**（VSCode）應該——那邊的版面是編輯器自己的事。
  { id: 'layout', kind: 'picker', domain: 'view', mountId: 'layout-selector-mount', bar: 'header', hostTitle: '選擇版面' },
  // 🔴 **程式在講話的地方**（2026-08-25，`draft/版面與檔案` §六之六）。
  { id: 'console', kind: 'output', domain: 'project', mountId: 'console-panel', bar: 'quickAccess', hostTitle: '主控台' },
  // 🔴 **執行時看的東西**——它的終局是 DAP 的 Variables 視圖（第五刀），
  //    而在那之前它的家是 `panel` 區的一個視圖，**與終端機同一排**。
  //    使用者 2026-08-25：「我要的是放在主控台跟終端機一起（在還沒做 DAP 的時候）」。
  { id: 'variables', kind: 'inspector', domain: 'project', mountId: 'variable-panel', bar: 'quickAccess', hostTitle: '變數' },
  { id: 'sync', kind: 'indicator', domain: 'project', mountId: 'sync-menu-btn', bar: 'quickAccess', hostTitle: '同步：暫停／以哪一邊為準' },
]

/** 每一種控制項投影到哪個表面。🔴 **一個宿主一張，三列**。 */
export type ControlSurfaces = Readonly<Record<ControlKind, ControlSurface>>

/** 這一顆投影到哪個表面。 */
export function surfaceOf(spec: ControlSpec, surfaces: ControlSurfaces): ControlSurface {
  return surfaces[spec.kind]
}

/** 這個宿主要不要自己畫這一顆。 */
export function drawnByPanel(spec: ControlSpec, surfaces: ControlSurfaces): boolean {
  return surfaces[spec.kind].startsWith('panel')
}

/** 這個宿主的面板要建哪些控制項。 */
export function panelControls(surfaces: ControlSurfaces): ControlSpec[] {
  return CONTROLS.filter((c) => drawnByPanel(c, surfaces))
}

/**
 * 執行模式的**唯一宣告**。
 *
 * 🔴 在此之前它散在三處：`app-shell.ts` 的選單標記、`execution-controller.ts`
 * 的型別聯集、以及同一個檔的標籤查表。
 * ⚠️ 而宿主那側還要第四份（分頁標題列的下拉）——**那正是該停下來的時候**。
 *
 * > **一份要被抄到第四個地方的清單，它的問題不是「再抄一次」，
 * > 是它從來就不該是散的。**
 */
export interface RunModeSpec {
  readonly id: RunModeId
  /** 顯示用的預設中文標籤。⚠️ 面板那側會用 `Blockly.Msg` 覆蓋，宿主那側用這個。 */
  readonly label: string
  /** 這一項之前要不要畫分隔線。 */
  readonly separatorBefore?: boolean
}

export type RunModeId =
  | 'run' | 'debug'
  | 'animate-slow' | 'animate-medium' | 'animate-fast'
  | 'step'

export const RUN_MODES: readonly RunModeSpec[] = [
  { id: 'run', label: '▶ 執行' },
  { id: 'debug', label: '🔍 除錯' },
  { id: 'animate-slow', label: '▷ 動畫（慢）', separatorBefore: true },
  { id: 'animate-medium', label: '▷ 動畫（中）' },
  { id: 'animate-fast', label: '▷ 動畫（快）' },
  { id: 'step', label: '⏭ 逐步', separatorBefore: true },
]

/**
 * 介面語系的**唯一宣告**。
 *
 * 🔴 原本寫死在 `ui/toolbar/locale-selector.ts` 的建構子裡——而宿主那側
 * 要同一份清單，於是它就要被抄第二次。
 *
 * ## ⚠️ `follow-host` 是一個**值**，不是「沒有值」
 *
 * 使用者 2026-08-25：「**跟宿主走（但是還是可以選）**」。
 *
 * > **顯式的預設與遺漏的空必須分得出來**——一個 `undefined`
 * > 表達不出「我要跟著 IDE」，它只表達得出「沒有人設定過」。
 *
 * 而「還是可以選」是硬需求：教學情境要得到「介面英文、積木中文」。
 */
export const FOLLOW_HOST_LOCALE = 'follow-host'

export interface LocaleSpec {
  readonly id: string
  readonly label: string
}

export const LOCALES: readonly LocaleSpec[] = [
  { id: FOLLOW_HOST_LOCALE, label: '跟隨宿主' },
  { id: 'zh-TW', label: '中文' },
  { id: 'en', label: 'English' },
]

// ─── 投影到宿主時，一顆控制項在線上長什麼樣 ───

export interface ControlOption {
  readonly value: string
  readonly label: string
  /**
   * 這一項屬於哪一組——**組名換的時候，選單上會多一列標題**。
   *
   * ⚠️ 標題列不可選、不參與搜尋、不佔鍵盤導覽的位置。
   * 宿主（VSCode）不支援分組的話，忽略它即可——它是**裝飾不是語義**。
   */
  readonly group?: string
  /** 跟在名字後面的淡色說明（例如「沒有板子常數」）。 */
  readonly description?: string
}

/**
 * 一顆控制項交給宿主的**完整狀態**。
 *
 * 🔴 **值域跟著一起送**——宿主不認得目標登錄表、風格預設、語系清單，
 * 而讓它認得就是把真相搬到第二個地方。
 */
export interface ControlState {
  readonly id: ControlId
  readonly kind: ControlKind
  /**
   * **這顆控制項叫什麼**（「選擇程式風格」）。
   *
   * ⚠️ 與 `label` 是兩件事：`label` 是**目前的值**（「Google 風格」）。
   * 🔴 狀態列上只放得下值，而選單的標題與設定清單的列名要的是名字
   * ——**兩者混用的症狀是「一張標題寫著目前值的選單」**。
   */
  readonly title: string
  /** 表面上顯示的字（狀態列的文字／標題列的提示）＝**目前的值**。 */
  readonly label: string
  readonly value?: string
  readonly options?: readonly ControlOption[]
  /** 多選（層級樹）。⚠️ 這時看 `picked`，不看 `value`。 */
  readonly multi?: boolean
  readonly picked?: readonly string[]
}

/** 宿主那側按下去之後回傳的東西。 */
export interface ControlInvoke {
  readonly id: ControlId
  readonly value?: string
  readonly values?: readonly string[]
}

/** 投影到宿主時，這顆控制項的指令 id。🔴 **一處產生，manifest 與主行程共用**。 */
export function hostCommandId(id: ControlId): string {
  return `semorphe.control.${id}`
}

/** 執行模式在宿主那側各自是一個指令——⚠️ 那正是 C/C++ 那顆 ▷ 下拉的做法。 */
export function runModeCommandId(id: RunModeId): string {
  return `semorphe.run.${id}`
}
