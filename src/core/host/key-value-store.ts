/**
 * **存放的埠**——核心要存東西時叫它，而**誰實作它由外面決定**。
 *
 * ## 🔴 它解的是什麼
 *
 * 2026-09-06 之前核心裡有 7 處直接叫 `localStorage`。而那是**一個宿主的東西**：
 *
 * ```
 * Node                  沒有它
 * VSCode 的擴充主程序    沒有它
 * 無痕／擋掉 storage     叫它會拋
 * ```
 *
 * > **一個「核心」如果它的存檔只在一個宿主上跑得起來，
 * > 那它不是核心，是那個宿主的一部分。**
 *
 * 🟢 而 VSCode 那側**今天就沒有用它**（那側的真相是文件）——所以這一刀
 * 不是去讓它實作，**是別讓它有一天變成必須實作**。
 *
 * ## ⚠️ 為什麼是「鍵值」而不是「路徑樹」
 *
 * 今天的消費者是兩把扁平的鑰匙（`semorphe-state`／`semorphe-progress`）。
 * 路徑樹是為了**多檔案**，而那不在這一刀（憲章 I：不得為假設性未來需求預留擴充）。
 *
 * 🟢 而多檔案來的那天，**路徑就是一種鑰匙**——這個形狀擋不到它。
 *
 * ## ⚠️ 為什麼沒有「列出全部鑰匙」
 *
 * 零個消費者。
 *
 * > **一個埠上的操作如果沒有人叫它，它記的不是能力，是想像。**
 *
 * 🔴 而它不是「以後再加很麻煩」：加一個操作要改的是**實作**，
 * 而實作只有兩個，都在這個 repo 裡。
 */

/**
 * 一個「用鑰匙存取字串」的地方。
 *
 * ⚠️ **值一律是字串**——序列化是呼叫端的事。埠不知道存的是什麼，
 * 那正是它能被任何宿主實作的原因。
 */
export interface KeyValueStore {
  /** 讀。沒有那把鑰匙就回 `null`——⚠️ 與「存了一個空字串」不同。 */
  read(key: string): string | null
  /**
   * 寫。
   *
   * 🔴 **回傳成不成功**，不是 `void`——寫入**真的會失敗**
   * （配額滿、storage 被擋、磁碟唯讀），而一個 `void` 的簽章
   * 讓呼叫端連「要不要處理」都問不出來。
   *
   * > **一個會失敗的操作如果簽章上看不出來，那它的失敗就只能靠猜。**
   */
  write(key: string, value: string): boolean
  /** 刪。⚠️ 刪一把不存在的鑰匙**不是錯誤**。 */
  remove(key: string): void
}

/**
 * **記憶體實作**——測試用，也是沒有宿主儲存時的退路。
 *
 * ⚠️ **不跨實例**：換一個 `new` 就是空的。那正是「記憶體」的意思，
 * 而測試靠它拿到互不干擾的起點。
 */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, string>()

  read(key: string): string | null {
    return this.map.get(key) ?? null
  }

  write(key: string, value: string): boolean {
    this.map.set(key, value)
    return true
  }

  remove(key: string): void {
    this.map.delete(key)
  }
}
