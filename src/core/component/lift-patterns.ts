/**
 * **膠囊自帶的 lift pattern**——第三種形狀的機制
 *
 * ## 三種形狀，兩種機制
 *
 * ```
 * strategies.ts 41 顆   lift 是共用判別式裡的一列資料   → 登錄呼叫（container-templates）
 * io.ts 68 顆           lift 是共用分派表裡的一列資料   → 登錄呼叫（single-arg-functions）
 * **共用產生器 97 顆**  lift 是一整個 pattern 物件      → **glob 直讀**（本檔）
 * ```
 *
 * ## ⚠️ 為什麼這一種不是登錄呼叫——那條教訓花了 400 行才買到
 *
 * 前兩種登錄的是「**這個名字屬於我**」，而共用的判別邏輯要**查**那張表
 * ——所以表必須在共用程式碼跑之前被填好，登錄呼叫是對的。
 *
 * 這一種搬走的是**一整筆資料**，沒有人要查它，只要它出現在 pattern 清單裡。
 *
 * **第一版照抄前兩種寫成登錄呼叫，壞了兩次**（`history/044`）：
 *
 * 1. 讀取發生在登錄之前（`loadLiftPatterns` 早於 `registerCppLifters`）→ 讀到空陣列
 * 2. 改成惰性併入之後仍然壞——**8 個測試檔各自組裝 lifter 而不呼叫
 *    `registerCppLifters`**（對照：113 個用共用的 `createTestLifter`），登錄從未發生
 *
 * 而**它沒有立刻爆**：共用檔裡還留著同名 pattern 時看不出來。
 *
 * > **把資料做成登錄呼叫，等於替它發明一個會忘記呼叫的時序。**
 * > 判準：**這個東西有沒有人要「查」它？**
 * > 有 → 登錄。沒有 → **glob 直讀**，與 `component.json`／`forms/blocks.json` 同類。
 *
 * ⚠️ 它同時是「**照抄已驗證的形狀**」的反例——前兩種的形狀是對的，
 * 而**這一顆不是同一類東西**。**照抄之前要先問「它是不是同一類」。**
 */

const file = import.meta.glob('/src/components/*/*/lift-pattern.json', { eager: true }) as Record<
  string,
  { default?: unknown }
>

/**
 * 膠囊自帶的 lift pattern。**glob 直讀，沒有時序問題，也沒有組裝點。**
 *
 * ⚠️ **一顆膠囊可以帶不只一筆。** 第一版寫 `.map(m => m.default ?? m)`
 * ——**一個檔一筆**，因為當時每顆都只有一筆。
 * `cpp:builtin_constant` 帶 6 筆（`true`／`false`／`nullptr`／`NULL`／`EOF`／`null`），
 * 於是整個陣列被當成**一筆** pattern 餵進去，`componentId` 讀成 `undefined`
 * ——**`true` 這個字從此辨識不出來**，而症狀是 13 段語料在執行期
 * 報 `UNKNOWN_COMPONENT: raw_code`（辨識失敗後降級的落點）。
 *
 * > **「每個檔案一筆」是一個沒有被寫下來的假設，
 * > 而它在第 N 顆元件身上才會被否證。**
 */
export function componentLiftPatterns(): unknown[] {
  return Object.values(file).flatMap((m) => {
    const o = m.default ?? m
    return Array.isArray(o) ? o : [o]
  })
}

/** 護欄用：每一筆是哪顆膠囊帶的。 */
export function componentLiftPatternSources(): [path: string, id: string][] {
  return Object.entries(file).flatMap(([p, m]) => {
    const o = m.default ?? m
    const items = (Array.isArray(o) ? o : [o]) as { id?: string }[]
    return items.map((x) => [p, String(x.id ?? '(無 id)')] as [string, string])
  })
}
