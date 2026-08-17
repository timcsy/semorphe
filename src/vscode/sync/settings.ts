/**
 * 設定 → 組態 —— **而它刻意不 import `vscode`**。
 *
 * ## 為什麼把解析切出來
 *
 * 優先序（語言覆寫 > 專案 > 使用者 > 內建預設）是**這一輪唯一有分支的邏輯**，
 * 而 `vscode` 這個模組在測試環境不存在（spec 138 實測撞過）。
 *
 * > **一個只有開 IDE 才驗得了的分支，實務上等於沒有人驗。**
 *
 * 所以宿主負責**把各層級的值挖出來**，這裡負責**決定哪一個勝出**。
 *
 * ## 🔴 而網頁版把三種東西混在一個 blob 裡，這裡只收其中一種
 *
 * `core/storage.ts` 的 `SavedState`：
 *
 * ```
 * tree / blocklyState / code                        ① 文件內容
 * targetId / topicId / styleId / enabledBranches    ② 組態  ← 只有這一類進設定
 * blockStyleId / locale                             ③ 使用者偏好
 * ```
 *
 * ⚠️ ① **在這裡不存在**——檔案就是真相。
 * 🟢 所以 `storageService` 在 VSCode 這一側**不是搬家，是消失**。
 */

/** 面板要用的組態。⚠️ 每一格都有值——**不讓 `undefined` 漏到下游**。 */
export interface PanelConfig {
  targetId: string
  topicId: string | null
  styleId: string | null
  blockStyleId: string
  locale: string
}

/**
 * 一格設定在各層級的值，由宿主挖出來。
 *
 * ⚠️ 順序**就是優先序**：愈前面愈優先。
 * 🔴 而「語言覆寫」放最前面——那正是
 * 「`.ino` 是 Arduino、`.cpp` 是 C++」這件事的實作。
 */
export interface LayeredValue<T> {
  /** 語言範圍的覆寫（`[arduino]` 那種） */
  language?: T
  /** 專案層級——**老師設一次的地方** */
  workspace?: T
  /** 使用者層級 */
  user?: T
}

export const DEFAULT_CONFIG: PanelConfig = {
  targetId: 'cpp-beginner',
  topicId: null,
  styleId: null,
  blockStyleId: 'default',
  locale: 'zh-TW',
}

/**
 * 挑出勝出的那一層。
 *
 * ⚠️ **用 `!== undefined` 判斷，不是用真值判斷**——
 * 一個刻意設成空字串或 `false` 的值也是「設過了」。
 * 靜默地把它當成沒設，就是「靜默降級」那一族。
 */
function pick<T>(layered: LayeredValue<T> | undefined, fallback: T): T {
  if (!layered) return fallback
  if (layered.language !== undefined) return layered.language
  if (layered.workspace !== undefined) return layered.workspace
  if (layered.user !== undefined) return layered.user
  return fallback
}

export interface RawSettings {
  target?: LayeredValue<string>
  topic?: LayeredValue<string>
  style?: LayeredValue<string>
  blockStyle?: LayeredValue<string>
  locale?: LayeredValue<string>
}

/**
 * 把各層級的原始值解析成一份完整的組態。
 *
 * 🔴 回傳的每一格都有值——⚠️ **讓 `undefined` 漏下去的話，
 * 下游會用自己的預設值補**，而那就是第二份真相。
 */
export function resolveConfig(raw: RawSettings): PanelConfig {
  return {
    targetId: pick(raw.target, DEFAULT_CONFIG.targetId),
    topicId: pick(raw.topic, DEFAULT_CONFIG.topicId as string | null),
    styleId: pick(raw.style, DEFAULT_CONFIG.styleId as string | null),
    blockStyleId: pick(raw.blockStyle, DEFAULT_CONFIG.blockStyleId),
    locale: pick(raw.locale, DEFAULT_CONFIG.locale),
  }
}
