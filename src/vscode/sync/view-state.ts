/**
 * per-uri 的視圖狀態 —— **而它是外觀，不是真相**。
 *
 * ## 🔴 一份資料換一個宿主就換了身分
 *
 * ```
 * 網頁版    沒有檔案 ⟹ 積木的擺放【就是】真相，存檔存的是它
 * VSCode    程式碼是真相 ⟹ 積木的位置【純粹是外觀】
 * ```
 *
 * > **同一份資料，換一個宿主就從真相降級成快取。**
 *
 * 🟢 而那條線也答了另一個問題：那 18 個「per-document 欄位」裡，
 * **從文件重算得出來的都不是狀態，是快取**——它們在切換文件時
 * 丟掉重建（量過 ≈ 13 ms）。**只有這個檔管的東西要真的保存。**
 *
 * ## ⚠️ 而它的 key 會變
 *
 * 一個還沒存檔的暫存分頁存成檔案時，身分從 `untitled:Untitled-1`
 * 變成 `file:///…/foo.ino` ——**同一份文件，兩個 key**。
 *
 * 🔴 而那正是使用者的主場景（「AI 給的 Code 他們貼上來」）
 * ——所以 `migrate` 不是邊角，是必經之路。
 *
 * ## 不 import `vscode`
 *
 * 儲存體以介面注入，讓它測得到（`vscode` 在測試環境不存在）。
 */

export interface ViewState {
  scrollX: number
  scrollY: number
  scale: number
  /** blockId → 位置。⚠️ 它是外觀，所以**丟了不會損失語義**。 */
  blockPositions: Record<string, { x: number; y: number }>
}

/** 宿主提供的鍵值儲存體（VSCode 是 `workspaceState`）。 */
export interface KeyValueStore {
  get(key: string): ViewState | undefined
  set(key: string, value: ViewState | undefined): void
  keys(): readonly string[]
}

const PREFIX = 'semorphe.viewState:'

export class ViewStateStore {
  private readonly store: KeyValueStore

  constructor(store: KeyValueStore) {
    this.store = store
  }

  get(uri: string): ViewState | undefined {
    return this.store.get(PREFIX + uri)
  }

  set(uri: string, state: ViewState): void {
    this.store.set(PREFIX + uri, state)
  }

  /**
   * 身分搬遷：暫存分頁存檔之後，把狀態搬到新的 key。
   *
   * ⚠️ **舊 key 要清掉** —— 留著的話它永遠不會再被讀到，
   * 而 `workspaceState` 沒有人會去掃它。**那是一個不會被發現的洩漏。**
   *
   * @returns 有沒有真的搬到東西（沒有舊狀態就是 `false`，那不是錯誤）
   */
  migrate(fromUri: string, toUri: string): boolean {
    const state = this.get(fromUri)
    if (state === undefined) return false
    this.set(toUri, state)
    this.store.set(PREFIX + fromUri, undefined)
    return true
  }

  /** 現在存了幾份。🔴 交棒與除錯時看得到它。 */
  get size(): number {
    return this.store.keys().filter((k) => k.startsWith(PREFIX)).length
  }
}

/** 一份空白的視圖狀態——⚠️ **顯式的預設，不讓呼叫端各自發明一份**。 */
export const EMPTY_VIEW_STATE: ViewState = {
  scrollX: 0,
  scrollY: 0,
  scale: 1,
  blockPositions: {},
}
