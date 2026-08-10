/**
 * 「C++ 自由函式呼叫 → 元件身分」的登錄表——**`io.ts` 路由器裡的分派表塌成登錄**
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
 * 判別邏輯共用（找 `call_expression`、取引數），要回家的是
 * 「`isalpha` 這個名字屬於我」這個**宣告**。
 *
 * ## 這張表為什麼從「單引數」長成「呼叫」
 *
 * 第八～十顆（`cpp:math_pow` / `math_unary` / `math_binary`）搬家時發現：
 * 它們的 lift 是 `std/cmath/lifters.ts` 裡一個**看起來像函式**的
 * `tryCmathLift`——而拆開看，它只是三筆「名字 → 身分 ＋ 引數槽名」的資料
 * 配上共用的判別。**同一種形狀，只是引數槽不是固定的 `value`。**
 *
 * → 所以表從 `名字 → conceptId` 擴成 `名字 → 形狀`。
 *   `registerSingleArgFunction` 留著，是這張表的一個**特例入口**
 *   （槽名固定 `value`、不記函式名），因為那個形狀已經被第二顆驗證過。
 *
 * ## ⚠️ 三張登錄表，各對一個語法位置
 *
 * | 表 | 語法位置 | 節點形狀 |
 * |---|---|---|
 * | `container-templates` | 宣告的型別 | `vector<int> v;` |
 * | **這一張** | 自由函式呼叫 | `sqrt(x)` |
 * | `method-concepts` | 方法呼叫 | `s.find_first_not_of(x)` |
 *
 * 不合併是因為**位置決定形狀**：方法多一個 `obj`，宣告根本不是呼叫。
 * 合併成一張要嘛塞進一堆 optional 欄位，要嘛在查詢端再分一次流。
 *
 * ## ⚠️ 為什麼登錄表住在核心，而值是 C++ 的字串
 *
 * 表是**空的**——核心只提供機制，資料由套件與膠囊登錄。
 * **核心給機制、套件給資料**（與 `container-templates.ts` 同一個處置）。
 */

/** 一個函式名對應的節點形狀。 */
export interface CallConceptShape {
  conceptId: string
  /**
   * 引數依序放進哪些子節點槽。`['base','exponent']` → 第一引數進 `base`。
   * ⚠️ **槽名是契約**，與 `component.json` 的 `children` 必須一致，
   * 否則產生器讀不到——而那是安靜的（子節點是空陣列，不是錯誤）。
   */
  argSlots: string[]
  /**
   * 把**被呼叫的函式名**記進節點的哪個屬性。
   *
   * `cpp:math_unary` 用一顆身分涵蓋 18 個函式（`sqrt`／`sin`／`log`…），
   * 靠 `func` 屬性區分。不填代表身分本身就唯一（`isalpha`）。
   */
  funcProp?: string
  來源: string
}

const 表 = new Map<string, CallConceptShape>()

/** 登錄一組函式名共用的一個形狀。 */
export function registerCallConcept(函式名們: string | string[], 形狀: CallConceptShape): void {
  for (const 名 of typeof 函式名們 === 'string' ? [函式名們] : 函式名們) {
    const 先來的 = 表.get(名)
    if (先來的 && 先來的.conceptId !== 形狀.conceptId) {
      throw new Error(
        `函式名「${名}」被登錄兩次且指向不同身分：` +
          `${先來的.conceptId}（${先來的.來源}）與 ${形狀.conceptId}（${形狀.來源}）。` +
          `不自動取其一——靜默覆蓋的症狀是「某個函式被辨識成另一個」。`,
      )
    }
    表.set(名, 形狀)
  }
}

/**
 * 登錄一個單引數函式名——**這張表的特例入口**（槽名 `value`、不記函式名）。
 *
 * 保留它不是為了相容，是因為那個形狀已經被第二顆膠囊驗證過，
 * 而**把已驗證的形狀換掉需要理由**。
 */
export function registerSingleArgFunction(函式名: string, conceptId: string, 來源: string): void {
  registerCallConcept(函式名, { conceptId, argSlots: ['value'], 來源 })
}

/** 函式名 → 形狀。認不得回傳 `undefined`（不是猜一個看起來合理的）。 */
export function callConceptFor(函式名: string): CallConceptShape | undefined {
  return 表.get(函式名)
}

/** 函式名 → 元件身分。 */
export function conceptForSingleArgFunction(函式名: string): string | undefined {
  return 表.get(函式名)?.conceptId
}

/** 護欄用：每一筆是誰登錄的。過渡表的筆數應該只降不升。 */
export function singleArgFunctionSources(): [函式名: string, 來源: string][] {
  return [...表.entries()].map(([k, v]) => [k, v.來源])
}
