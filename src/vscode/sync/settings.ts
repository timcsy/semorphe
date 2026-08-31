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
  /**
   * 使用者選的語系**偏好**——⚠️ 它可以是 `follow-host`。
   *
   * 🔴 預設就是 `follow-host`（2026-08-25 人拍板「跟宿主走，但是還是可以選」）。
   */
  locale: string
  /**
   * 宿主的顯示語言（`vscode.env.language`）——`follow-host` 解析成什麼看它。
   *
   * ⚠️ 它**不是設定**，是環境。所以它不在 `RawSettings` 裡，
   * 由主行程直接填。
   */
  hostLocale: string
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
  // 🔴 這裡曾經寫 `'cpp-beginner'`——**而那個目標不存在**
  //    （登錄的四個是 `cpp` / `c` / `cpp-advanced` / `arduino`）。
  //    ⚠️ 一個認不得的 ID 在下游是「回退到現況」，所以它**不會出聲**
  //    ——設定看起來有在運作，實際上這一格從來沒有生效過。
  targetId: 'cpp',
  topicId: null,
  styleId: null,
  blockStyleId: 'default',
  // 🔴 預設跟隨宿主——而「跟隨」是**一個值**，不是「沒有值」。
  locale: 'follow-host',
  // ⚠️ 空字串 ＝ 這個宿主沒說（網頁版就是這樣）。
  hostLocale: '',
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
/**
 * 由**檔名**決定預設目標。
 *
 * 🔴 使用者逐字：「`.ino` 應該跟 main 架構無關」——而實測他的 sketch 被寫成
 *
 * ```cpp
 * using namespace std;
 * int main() {
 *     void setup() { … }
 *     void loop() { … }
 *     return 0;
 * }
 * ```
 *
 * ⚠️ **那不是顯示問題，它寫進了使用者的檔案。**
 *
 * > **一個「通用的預設」在一個有明確慣例的檔案格式上，
 * > 不是中立，是錯的。**
 *
 * 而這只是**預設**：`semorphe.target` 設過的話仍然照設定走（`pick` 在前）。
 */
export function defaultTargetForPath(path: string | undefined): string {
  if (path && /\.(ino|pde)$/i.test(path)) return 'arduino'
  return DEFAULT_CONFIG.targetId
}

export function resolveConfig(raw: RawSettings, documentPath?: string, hostLocale?: string): PanelConfig {
  return {
    // 🔴 **`?? ` 不可省**：`pick()` 對一個【明確設成 null】的層會回傳 `null`
    //    （它只跳過 `undefined`），而 `null` 到了下游是「沒有目標」——
    //    於是面板停在預設的 `cpp`，C++ 的骨架把 `int main()` 接到 `.ino` 上。
    //
    // ⚠️ 而 `semorphe.target` 的預設就是 `null`（2026-08-31 改的，理由見 manifest），
    //    所以這一格**每一次都會走到**。
    //
    // > **一個「沒設定」的表示法如果有兩種（`undefined` 與 `null`），
    // > 只處理一種的判斷會在另一種上安靜地給出錯的答案。**
    targetId: pick(raw.target, defaultTargetForPath(documentPath)) ?? defaultTargetForPath(documentPath),
    topicId: pick(raw.topic, DEFAULT_CONFIG.topicId as string | null),
    styleId: pick(raw.style, DEFAULT_CONFIG.styleId as string | null),
    blockStyleId: pick(raw.blockStyle, DEFAULT_CONFIG.blockStyleId),
    locale: pick(raw.locale, DEFAULT_CONFIG.locale),
    hostLocale: hostLocale ?? DEFAULT_CONFIG.hostLocale,
  }
}
