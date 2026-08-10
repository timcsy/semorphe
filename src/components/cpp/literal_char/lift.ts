/**
 * `cpp:literal_char` 的 **lift** 路——**第三種形狀：一整個 pattern 物件**
 *
 * 內容在 `./lift-pattern.json`，由 `core/component/lift-patterns.ts` **glob 直讀**。
 *
 * 這個函式因此是**空的**，而它必須存在：`core/component/paths.ts` 要求
 * 宣告了 `paths.lift` 的膠囊必須匯出 `registerLift()`
 * ——**匯出名字對不上就擲錯，不是安靜地少一路**。
 *
 * > **資料不需要被登錄，它需要被找到。**（`history/044`，花了 400 行買到的）
 * > 前兩顆膠囊的 lift 是登錄呼叫，因為共用的判別邏輯要**查**那張表。
 * > 這一顆沒有人要查它——只要它出現在 pattern 清單裡。
 */
export function registerLift(): void {
  // 內容是 `./lift-pattern.json`，glob 直讀。見檔頭。
}
