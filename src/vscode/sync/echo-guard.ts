/**
 * 回音守衛 —— **認得出「這個變更是我們自己造成的」**。
 *
 * ## 問題
 *
 * 雙向同步的經典迴圈：改積木 → 寫文件 → 文件變更事件 → 重畫積木 → …
 *
 * ## 🔴 而它【不用時間】，這一點是刻意的
 *
 * `experience.md:2866` 記著上一個做法：
 *
 * > 「同步宿主用布林旗標就夠，**非同步宿主要加時間**」
 *
 * 而那一則自己標了它的弱點：
 *
 * > ⚠️ 用時間的那個版本，**那個常數是猜的**（50ms 沒有人驗過夠不夠）。
 * > 把它標成猜測，並在它出問題時**先懷疑它**。
 *
 * 🟢 文件的版本號**單調遞增**（宿主保證，含 undo／redo），
 * 所以回音有一個**身分**可以認：
 *
 * ```
 * 送出編輯 → 記下產生的版本
 * 事件進來 → 版本在集合裡？ 是 → 回音，移除並忽略
 * ```
 *
 * > **非同步宿主要的不是「時間」，是一個身分。
 * > 加時間是在猜「回音應該多久之內回來」——而那個猜測沒有上界。**
 *
 * ## ⚠️ 為什麼是【集合】不是一個變數
 *
 * 連續快速編輯會產生多個版本，而事件是**非同步送達**的。
 * 只記「上一個」的話，先前那個回音回來時會被誤判成外來變更
 * ——**而那正是無窮迴圈的入口**。
 *
 * ## 上界用數量，不用時間
 *
 * 一個永遠不回來的版本不該讓集合長到無限。
 * 🔴 而上界**不可以是時間**——那會把被趕出去的猜測偷渡回來。
 * 用容量：超過就丟最舊的。
 *
 * ## 🔴 而「記下產生的版本」有一個時序陷阱——2026-08-18 付過學費
 *
 * ```ts
 * const ok = await editor.edit(...)     // ← 文件變更事件在【這裡面】就發了
 * if (ok) this.echo.remember(doc.version)   // ← 太晚：那時 pending 還是空的
 * ```
 *
 * `onDidChangeTextDocument` 在 `edit()` 的 Promise 解析**之前**觸發，
 * 於是 `isEcho` 回 `false` → 宿主把自己造成的變更當成外來的 → **重送文件**
 * → code→blocks → **使用者剛改的積木被回捲**。
 *
 * ⚠️ 使用者實測的症狀是「改了 mutation 之後直接跳回純宣告」
 * ——而那看起來像是積木的錯，其實是這裡的時序。
 *
 * > **「記下我做了什麼」如果發生在「做」之後，
 * > 那麼在「做」的當下問「這是我做的嗎」，答案永遠是否。**
 *
 * 處置：`beginApply()` / `endApply()` 把整段編輯圈起來——
 * **圈內收到的任何版本都算我們的**，不必等到知道版本號才記。
 */
export class EchoGuard {
  /** 我們送出的編輯所產生的文件版本。**插入順序 ＝ 最舊在前**。 */
  private readonly pending = new Set<number>()
  private readonly capacity: number

  /**
   * @param capacity 最多記幾個未回收的版本。
   *   ⚠️ 預設值大得足以涵蓋任何合理的連續編輯，而**它不是時間**。
   */
  /** 🔴 一次 `editor.edit` 正在進行中——見檔頭的時序陷阱。 */
  private applying = false

  constructor(capacity = 64) {
    this.capacity = Math.max(1, capacity)
  }

  /**
   * 🔴 **一次編輯開始了。** 圈內收到的版本一律算我們的。
   *
   * ⚠️ 這不是「布林旗標取代版本身分」——版本身分仍然在管**圈外**的回音
   * （事件比 Promise 晚到的那些）。這一層管的是**圈內**，而那是版本號
   * 還不知道的那一段。
   */
  beginApply(): void {
    this.applying = true
  }

  /** 編輯結束。⚠️ **必須在 `finally` 裡呼叫**——否則一次例外會讓守衛永遠開著。 */
  endApply(): void {
    this.applying = false
  }

  /** 我們剛送出的編輯產生了這個版本。 */
  remember(version: number): void {
    this.pending.add(version)
    // Set 保留插入順序 → 第一個就是最舊的。
    while (this.pending.size > this.capacity) {
      const oldest = this.pending.values().next().value
      if (oldest === undefined) break
      this.pending.delete(oldest)
    }
  }

  /**
   * 這個版本是我們造成的嗎？
   *
   * ⚠️ **有副作用**：認出來就消掉——同一個版本不會被認第二次。
   * 那讓「回音已經處理完了」與「還在等」分得出來。
   */
  isEcho(version: number): boolean {
    // 🔴 編輯進行中 → **一定是我們造成的**，而且順手記下版本
    //    （圈外可能還會有一則同版本的事件晚到）。
    if (this.applying) { this.pending.add(version); return true }
    return this.pending.delete(version)
  }

  /** 切換文件時清空——上一份文件的版本號與這一份無關。 */
  reset(): void {
    this.pending.clear()
    this.applying = false
  }

  /** 還在等幾個回音。🔴 交棒時讀數要顯示它（見 `quickstart.md` 第三節）。 */
  get pendingCount(): number {
    return this.pending.size
  }
}
