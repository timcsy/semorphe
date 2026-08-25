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
 * ```
 *
 * ⚠️ 而 `domain` 是**另一個軸**，它不決定表面，它回答「為什麼不該待在積木面板」：
 * 一顆 `session` 的控制項（這個檔案用什麼語言）**跟積木沒有關係**，
 * 它待在積木面板裡只是歷史。
 */

/** 使用者拿它做什麼——🔴 **表面由這一格決定**。 */
export type ControlKind = 'picker' | 'action' | 'indicator'

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
  | 'hostStatusBar'
  | 'hostTitleBar'

export type ControlId =
  | 'target' | 'branches' | 'style' | 'blockStyle' | 'locale'
  | 'run' | 'undo' | 'redo' | 'clear'
  | 'sync'

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
  { id: 'branches', kind: 'picker', domain: 'session', mountId: 'level-selector-mount', bar: 'quickAccess', hostTitle: '選擇教學層級' },
  { id: 'style', kind: 'picker', domain: 'session', mountId: 'style-selector-mount', bar: 'header', hostTitle: '選擇程式風格' },
  { id: 'blockStyle', kind: 'picker', domain: 'session', mountId: 'block-style-selector-mount', bar: 'quickAccess', hostTitle: '選擇積木風格' },
  { id: 'locale', kind: 'picker', domain: 'session', mountId: 'locale-selector-mount', bar: 'header', hostTitle: '選擇介面語言' },
  { id: 'run', kind: 'action', domain: 'project', mountId: 'run-btn', bar: 'header', hostTitle: '執行', icon: '$(play)' },
  { id: 'undo', kind: 'action', domain: 'view', mountId: 'undo-btn', bar: 'quickAccess', hostTitle: '復原', icon: '$(discard)' },
  { id: 'redo', kind: 'action', domain: 'view', mountId: 'redo-btn', bar: 'quickAccess', hostTitle: '重做', icon: '$(redo)' },
  { id: 'clear', kind: 'action', domain: 'view', mountId: 'clear-btn', bar: 'quickAccess', hostTitle: '清空積木', icon: '$(clear-all)' },
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
  return surfaces[spec.kind] === 'panelToolbar' || surfaces[spec.kind] === 'panelStatusBar'
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
  /** 表面上顯示的字（狀態列的文字／標題列的提示）。 */
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
