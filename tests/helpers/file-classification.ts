/**
 * 一個檔案是**宣告／清單／實作／清冊**——跨護欄共用的一份分類
 *
 * ## 為什麼要共用
 *
 * 這份分類原本寫在 `audit-component-identity-review.test.ts` 裡。就近性護欄
 * 需要同一個判準（課程清單與工具箱清單不是「實作擴散」），而**各寫一份就是
 * 兩份會漂移的真相**——那正是這個專案的頭號病。
 *
 * ## 判準是**路徑規則**，不是一份檔名清單（FC-1）
 *
 * 手寫檔名的話，新增一份清單檔要記得去改分類，而忘了改的方向剛好是
 * 「被算成實作」——數字會無聲地變差，然後有人去調基線。
 *
 * ## ⚠️ 這不是「為了讓數字好看而改量測」
 *
 * 改完之後就近性的數字**會下降**，而那是重新分類造成的，不是實作變好了。
 * `history/018` 的直接處方：兩者混在同一個數字裡的話，用改量測刷分數
 * 看起來會像進步。**下降必須說明原因並在基線註記。**
 */

export type FileClass = '宣告' | '清單' | '實作' | '清冊' | '測試'

/**
 * | 類別 | 是什麼 | 例 |
 * |---|---|---|
 * | **宣告** | 元件自己的定義 | `std/vector/concepts.json`、`universal-blocks.json` |
 * | **清單** | 登錄表的視圖／策展／歷史名冊 | `topics/*.json`、`toolbox-categories.ts`、`id-migrations.ts` |
 * | **實作** | 真的做事的程式碼 | `std/vector/executors.ts`、測試 |
 * | **清冊** | 產生出來的紀錄 | `tests/baselines/*`、`tests/assets/*` |
 * | **測試** | 驗證用的程式碼 | `src/components/*​/*​/spec.test.ts` |
 *
 * ## 為什麼「測試」要單獨一類（2026-08-10，spec 104）
 *
 * 元件膠囊的**自證測住在膠囊裡**，而它的負向斷言**必然提到別的元件身分**
 * ——「`stack<int> s` 不得被認成 `cpp:vector_declare`」這種話講不出來就沒有負向。
 *
 * 算成實作擴散的話，一顆元件搬進膠囊會讓**別的七顆元件的擴散度上升**，
 * 而它們一行都沒有動。第一次跑就抓到七筆（`cpp:var_declare` 7 → 8 檔…）。
 *
 * ⚠️ **這不是為了讓數字好看而改量測**（`history/018`）：判準是「這個檔在
 * production 執行嗎」，而測試不在。`tests/` 底下的檔從來就不在就近性的掃描
 * 範圍內——膠囊只是把同一種檔案搬進了 `src/`。
 */
export function classifyFile(rel: string): FileClass {
  if (/\/(concepts|blocks)\.json$/.test(rel) || /universal-(concepts|blocks)\.json$/.test(rel)) return '宣告'
  // 元件膠囊的 `component.json` **是宣告**，與 `concepts.json` 同一類——
  // 它就是那一筆記錄搬了個家。不加這一條的話，一顆搬進膠囊的元件會因為
  // 「多了一個實作檔」而讓就近性數字**上升**，而它明明變集中了。
  if (/\/component\.json$/.test(rel)) return '宣告'
  // ⚠️ **身分改名表是清單，不是實作。** `id-migrations.ts` 列出「這顆元件
  // 曾經叫什麼」——那是凍結的歷史名冊，不是它的實作散到那裡去了。
  // 不加這一條的話，遷移一落地，就近性會回報 168 顆元件擴散超標，
  // 而那與 E 項踩過的是同一個誤判（`history/029`：把清單算成實作擴散）。
  if (/\/(topics|templates)\//.test(rel) || /toolbox-categories\.ts$/.test(rel)) return '清單'
  if (/id-migrations\.ts$/.test(rel)) return '清單'
  if (/^tests\/(baselines|assets|reports)\//.test(rel)) return '清冊'
  if (/\.test\.ts$/.test(rel)) return '測試'
  return '實作'
}
