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

export type FileClass = '宣告' | '清單' | '實作' | '清冊'

/**
 * | 類別 | 是什麼 | 例 |
 * |---|---|---|
 * | **宣告** | 元件自己的定義 | `std/vector/concepts.json`、`universal-blocks.json` |
 * | **清單** | 登錄表的視圖／策展 | `topics/*.json`、`toolbox-categories.ts` |
 * | **實作** | 真的做事的程式碼 | `std/vector/executors.ts`、測試 |
 * | **清冊** | 產生出來的紀錄 | `tests/baselines/*`、`tests/assets/*` |
 */
export function classifyFile(rel: string): FileClass {
  if (/\/(concepts|blocks)\.json$/.test(rel) || /universal-(concepts|blocks)\.json$/.test(rel)) return '宣告'
  if (/\/(topics|templates)\//.test(rel) || /toolbox-categories\.ts$/.test(rel)) return '清單'
  if (/^tests\/(baselines|assets|reports)\//.test(rel)) return '清冊'
  return '實作'
}
