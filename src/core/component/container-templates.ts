/**
 * 「C++ 樣板容器名 → 元件身分」的登錄表——**共用判別式塌成路由器**
 *
 * ## 為什麼需要這個
 *
 * `cpp:vector_declare` 的 lift 那一路**不是一個可以搬走的函式**，
 * 是七顆容器共用的一個 strategy 函式裡的**一列**：
 *
 * ```ts
 * const containerConcepts = { 'vector': 'cpp:vector_declare', 'stack': …, … }
 * ```
 *
 * 搬一顆進膠囊，就必須讓那一列**從膠囊來**。
 *
 * 這個形狀專案做過兩次且都成功——P3「`io.ts` 塌成路由器」、
 * E 項「工具箱從手寫 80 筆改成 45 段有序來源」。判別邏輯留在共用檔（它本來就
 * 是共用的），**資料**回到各自的家。
 *
 * ## ⚠️ 為什麼登錄表住在核心，而值是 C++ 的字串
 *
 * 表是**空的**——核心只提供機制，資料由套件與膠囊登錄。
 * 這與 D 的改名表、G 的詞彙表是同一個處置：
 * **核心給機制、套件給資料**（那個錯犯過兩次，隔一天各一次）。
 */

const 表 = new Map<string, { conceptId: string; 來源: string }>()

/**
 * 登錄一個樣板名。
 *
 * @param 樣板名 C++ 的樣板容器名（`vector`／`stack`…）
 * @param conceptId 對應的元件身分
 * @param 來源 誰登錄的——膠囊填自己的資料夾，過渡表填 `'(尚未元件化)'`
 */
export function registerContainerTemplate(樣板名: string, conceptId: string, 來源: string): void {
  const 先來的 = 表.get(樣板名)
  if (先來的 && 先來的.conceptId !== conceptId) {
    throw new Error(
      `樣板名「${樣板名}」被登錄兩次且指向不同身分：` +
        `${先來的.conceptId}（${先來的.來源}）與 ${conceptId}（${來源}）。` +
        `不自動取其一——靜默覆蓋的症狀是「某種容器被辨識成另一種」。`,
    )
  }
  表.set(樣板名, { conceptId, 來源 })
}

/** 樣板名 → 元件身分。認不得回傳 `undefined`（不是猜一個看起來合理的）。 */
export function conceptForContainerTemplate(樣板名: string): string | undefined {
  return 表.get(樣板名)?.conceptId
}

/** 護欄用：每一筆是誰登錄的。過渡表的筆數應該只降不升。 */
export function containerTemplateSources(): [樣板名: string, 來源: string][] {
  return [...表.entries()].map(([k, v]) => [k, v.來源])
}

/**
 * **非樣板的型別名 → 身分**——`string s;`／`ifstream f;`／`stringstream ss;`
 *
 * 與上面那張的差別是**語法位置**：容器樣板是 `vector<int> v;`（template_type），
 * 這些是 `string s;`（type_identifier，可能包在 `std::` 裡）。
 * 判別邏輯不同，所以是兩張表——**位置決定形狀**（同 `call-concepts` 的三表註解）。
 *
 * ⚠️ 表是空的：核心給機制、套件給資料。
 */
const 型別名表 = new Map<string, { conceptId: string; 來源: string }>()

export function registerPlainTypeConcept(型別名: string, conceptId: string, 來源: string): void {
  const 先來的 = 型別名表.get(型別名)
  if (先來的 && 先來的.conceptId !== conceptId) {
    throw new Error(
      `型別名「${型別名}」被登錄兩次且指向不同身分：` +
        `${先來的.conceptId}（${先來的.來源}）與 ${conceptId}（${來源}）。`,
    )
  }
  型別名表.set(型別名, { conceptId, 來源 })
}

/** 型別名 → 元件身分。認不得回 `undefined`。 */
export function plainTypeConcept(型別名: string): string | undefined {
  return 型別名表.get(型別名)?.conceptId
}
