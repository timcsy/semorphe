/**
 * 「C++ 單引數函式名 → 元件身分」的登錄表——**`io.ts` 路由器裡的分派表塌成登錄**
 *
 * ## 為什麼需要這個
 *
 * `cpp:char_is_alpha` 的 lift 那一路**不是一個可以搬走的函式**，
 * 是 `lifters/io.ts` 裡一張分派表中的**一筆資料**：
 *
 * ```ts
 * const cctypeFuncs = { 'isalpha': 'cpp:char_is_alpha', 'isdigit': …, … }
 * ```
 *
 * ⚠️ **而這正是第一顆膠囊遇到的同一個形狀。**
 * `specs/104` 把 `io.ts` 那 68 顆列為「處方尚未實測」的一批，
 * 實測結果是：**它與 `strategies.ts` 那 41 顆是同一種形狀**——
 * 判別邏輯共用（找 `call_expression`、取第一個引數），要回家的是
 * 「`isalpha` 這個名字屬於我」這個**宣告**。
 *
 * → 那 109 顆的成本估計因此可以合併，見 `specs/113`。
 *
 * ## ⚠️ 為什麼登錄表住在核心，而值是 C++ 的字串
 *
 * 表是**空的**——核心只提供機制，資料由套件與膠囊登錄。
 * **核心給機制、套件給資料**（與 `container-templates.ts` 同一個處置）。
 */

const 表 = new Map<string, { conceptId: string; 來源: string }>()

/**
 * 登錄一個單引數函式名。
 *
 * @param 函式名 C++ 的函式名（`isalpha`／`toupper`…）
 * @param conceptId 對應的元件身分
 * @param 來源 誰登錄的——膠囊填自己的資料夾，過渡表填 `'(尚未元件化)'`
 */
export function registerSingleArgFunction(函式名: string, conceptId: string, 來源: string): void {
  const 先來的 = 表.get(函式名)
  if (先來的 && 先來的.conceptId !== conceptId) {
    throw new Error(
      `函式名「${函式名}」被登錄兩次且指向不同身分：` +
        `${先來的.conceptId}（${先來的.來源}）與 ${conceptId}（${來源}）。` +
        `不自動取其一——靜默覆蓋的症狀是「某個函式被辨識成另一個」。`,
    )
  }
  表.set(函式名, { conceptId, 來源 })
}

/** 函式名 → 元件身分。認不得回傳 `undefined`（不是猜一個看起來合理的）。 */
export function conceptForSingleArgFunction(函式名: string): string | undefined {
  return 表.get(函式名)?.conceptId
}

/** 護欄用：每一筆是誰登錄的。過渡表的筆數應該只降不升。 */
export function singleArgFunctionSources(): [函式名: string, 來源: string][] {
  return [...表.entries()].map(([k, v]) => [k, v.來源])
}
