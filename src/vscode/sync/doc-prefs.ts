/**
 * **這份文件上，使用者選了什麼**（2026-09-01）。
 *
 * ## 🔴 它從哪來
 *
 * 使用者開了一份 C++ 的暫存檔，而狀態列寫著「Arduino（不指定板子）」
 * 與「Arduino 骨架・hidden」。他說：「**C++ 一開始要預設 C++ 吧**」。
 *
 * 而那是我上一刀弄壞的：為了讓三個面板一致，我讓每一顆 picker 選完就寫回
 * **workspace 設定**——於是一次「我這個檔要用 Arduino」變成了
 * **整個專案的**設定，把 `manifest.ts` 上寫著的那句話蓋掉：
 *
 * > `null` ⟹ `pick()` 落到 `defaultTargetForPath()`：`.ino`／`.pde` 自動選
 * > arduino，其餘落到 cpp。**那才是使用者要的行為，而且不必設定任何東西。**
 *
 * > **一份偏好寫回去的範圍，不得大於它描述的東西
 * > ——把「這個檔」寫成「這個專案」，它就會去回答它沒被問到的問題。**
 *
 * ## 為什麼是這裡，不是設定檔、也不是存檔服務
 *
 * ```
 * semorphe.* 設定    老師擺一次的東西      ⚠️ 我們不該去寫它
 * 存檔服務            這個宿主刻意不存      🔴 檔案才是真相（DocumentlessStorage）
 * workspaceState     宿主自己的、per-uri   🟢 而且【所有面板共用一份】
 * ```
 *
 * ⚠️ 而「所有面板共用一份」正是重點：三個面板不同調的根因是那些選擇**沒有家**。
 * 它們現在有家了，而那個家在**宿主**——不是其中一個面板。
 *
 * > **一個必須被餵才畫得出來的視圖，它不是在投影
 * > ——而讓它們一致的辦法是給那份狀態一個共用的家，不是讓其中一個當家。**
 *
 * 🔴 形狀刻意與 `view-state.ts` 一模一樣（含存檔那一刻的身分搬遷）
 * ——⚠️ 而它**不認識 `vscode`**：那個模組在測試環境不存在。
 */

/** 使用者在這份文件上選過的東西。⚠️ 每一格都是選填——沒選過就跟著推導走。 */
export interface DocPrefs {
  targetId?: string
  skeletonId?: string
  scaffoldMode?: string
  styleId?: string
  topicId?: string
}

/** 宿主提供的鍵值儲存體（VSCode 是 `workspaceState`）。 */
export interface PrefStore {
  get(key: string): DocPrefs | undefined
  set(key: string, value: DocPrefs | undefined): void
  keys(): readonly string[]
}

const PREFIX = 'semorphe.docPrefs:'

export class DocPrefStore {
  private readonly store: PrefStore

  constructor(store: PrefStore) {
    this.store = store
  }

  get(uri: string): DocPrefs {
    return this.store.get(PREFIX + uri) ?? {}
  }

  /**
   * 記下一格。
   *
   * ⚠️ **合併，不是覆寫**——一次只選一顆 picker，而其餘幾格不該被清掉。
   */
  merge(uri: string, patch: DocPrefs): void {
    this.store.set(PREFIX + uri, { ...this.get(uri), ...patch })
  }

  /**
   * 身分搬遷：暫存分頁存檔之後，把偏好搬到新的 key。
   *
   * ⚠️ **舊 key 要清掉**——留著的話它永遠不會再被讀到，而
   * `workspaceState` 沒有人會去掃它。**那是一個不會被發現的洩漏。**
   */
  migrate(fromUri: string, toUri: string): boolean {
    const prefs = this.store.get(PREFIX + fromUri)
    if (prefs === undefined) return false
    this.store.set(PREFIX + toUri, prefs)
    this.store.set(PREFIX + fromUri, undefined)
    return true
  }

  /** 現在存了幾份。🔴 交棒與除錯時看得到它。 */
  get size(): number {
    return this.store.keys().filter((k) => k.startsWith(PREFIX)).length
  }
}

/** `configChanged` 的鍵 → `DocPrefs` 的欄位。⚠️ 不在這張表上的**不進這裡**。 */
export const DOC_PREF_KEYS: Readonly<Record<string, keyof DocPrefs>> = {
  target: 'targetId',
  skeleton: 'skeletonId',
  scaffold: 'scaffoldMode',
  style: 'styleId',
  topic: 'topicId',
}
