/**
 * **合併掉的身分**（v1 → v2）——凍結的歷史名冊
 *
 * ## 為什麼它從 `storage-version.ts` 搬出來（2026-08-11）
 *
 * 它原本住在升級機制那個檔裡。而它**不是機制，是資料**——
 * 「這顆元件曾經叫什麼」是歷史事實，與 `id-migrations.ts` 同一類。
 *
 * ⚠️ 住錯地方有代價：就近性護欄把 `storage-version.ts` 判為「實作」
 * （它確實含實作），於是**這張表裡的每一顆身分都被算成一次實作擴散**
 * ——`cpp:increment` 因此搬不進膠囊，而它一行實作都不在那裡。
 *
 * > **一張凍結的名冊住在機制檔裡，會讓它列到的每一顆元件都多背一筆擴散。**
 *
 * 搬到 `blocks/` 之後與 `id-migrations.ts` 同目錄、同分類（清單）。
 */
/**
 * 升級路徑註冊表。**目前刻意是空的——沒有需要升級的版本。**
 *
 * 它不是為未來預留的：沒有它，「版本較舊」只剩「拒絕」一條路，而
 * `CURRENT_VERSION` 首次調成 2 的那天，那等於拒絕掉每一位既有使用者的
 * 存檔——**比現況更糟**。它完成的是當下的 `needs-upgrade` 分支。
 *
 * `storage-version.test.ts` 有一支測試釘住「從 1 到 `CURRENT_VERSION` 的
 * 每一步都必須有註冊」。調高版本卻忘了寫升級函式，那支測試會變紅。
 */
/**
 * 1 → 2：**六對 statement／expression 雙版本合併成六個身分**（階段 6.5 的 B 項）。
 *
 * ## 為什麼這動得起
 *
 * P8「不做向後相容」的**範圍**已於 2026-08-07 釐清為**不含語義詞彙本身**
 * （`knowledge/history/026`）：P8 推導自「投影可重建」，而 componentId 改名動的是
 * **真實**，沒有東西可以重建它。這類變更 MUST 附一次性轉換。
 *
 * **這是那條釐清的第一次真正使用。**
 *
 * ## 只轉語義樹，不轉積木
 *
 * 積木型別是**加法式**保留的（`cpp_increment_expression` 仍然有效，只是現在對應到
 * `cpp_increment`）。轉積木型別是不必要的，而不必要的轉換是額外的風險面。
 */
export const 合併掉的身分: Record<string, string> = {
  func_call_expr: 'func_call',
  cpp_method_call_expression: 'cpp:method_call',
  cpp_increment_expr: 'cpp:increment',
  cpp_compound_assign_expr: 'cpp:compound_assign',
  var_declare_expr: 'var_declare',
  cpp_scanf_expr: 'cpp:scanf',
}