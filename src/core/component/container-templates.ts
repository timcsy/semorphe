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

import { registeredComponents } from './registry'

const table = new Map<string, { componentId: string; source: string }>()

/**
 * 登錄一個樣板名。
 *
 * @param templateName C++ 的樣板容器名（`vector`／`stack`…）
 * @param componentId 對應的元件身分
 * @param source 誰登錄的——膠囊填自己的資料夾，過渡表填 `'(尚未元件化)'`
 */
export function registerContainerTemplate(templateName: string, componentId: string, source: string): void {
  const existing = table.get(templateName)
  if (existing && existing.componentId !== componentId) {
    throw new Error(
      `樣板名「${templateName}」被登錄兩次且指向不同身分：` +
        `${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。` +
        `不自動取其一——靜默覆蓋的症狀是「某種容器被辨識成另一種」。`,
    )
  }
  table.set(templateName, { componentId, source })
}

/** 樣板名 → 元件身分。認不得回傳 `undefined`（不是猜一個看起來合理的）。 */
export function conceptForContainerTemplate(templateName: string): string | undefined {
  return table.get(templateName)?.componentId
}

/** 護欄用：每一筆是誰登錄的。過渡表的筆數應該只降不升。 */
export function containerTemplateSources(): [templateName: string, source: string][] {
  return [...table.entries()].map(([k, v]) => [k, v.source])
}

/**
 * **非樣板的型別名 → 身分**——`string s;`／`ifstream f;`／`stringstream ss;`
 *
 * 與上面那張的差別是**語法位置**：容器樣板是 `vector<int> v;`（template_type），
 * 這些是 `string s;`（type_identifier，可能包在 `std::` 裡）。
 * 判別邏輯不同，所以是兩張表——**位置決定形狀**（同 `call-components` 的三表註解）。
 *
 * ⚠️ 表是空的：核心給機制、套件給資料。
 */
const typeNameTable = new Map<string, { componentId: string; source: string }>()

export function registerPlainTypeConcept(typeName: string, componentId: string, source: string): void {
  const existing = typeNameTable.get(typeName)
  if (existing && existing.componentId !== componentId) {
    throw new Error(
      `型別名「${typeName}」被登錄兩次且指向不同身分：` +
        `${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。`,
    )
  }
  typeNameTable.set(typeName, { componentId, source })
}

/** 型別名 → 元件身分。認不得回 `undefined`。 */
export function plainTypeConcept(typeName: string): string | undefined {
  return typeNameTable.get(typeName)?.componentId
}

/**
 * **這個型別是硬體裝置嗎**——由它自己的宣告說。
 *
 * ## 🔴 為什麼需要它：`begin()` 在兩個世界裡是兩件事
 *
 * ```
 * v.begin()      容器 → 取得迭代器
 * dht.begin()    裝置 → 啟動它
 * lcd.begin(16,2)
 * ```
 *
 * ⚠️ 而**不能用「有沒有登錄成純型別」來分**：`string` 也是純型別，
 * 而 `str.begin()` **確實是**迭代器。第一版就是這樣寫的，它會把字串弄壞。
 *
 * 🟢 判準改成問**擁有者**：硬體元件的 `owner` 是 `'(arduino)'`，
 * 而容器與標準庫型別不是。**「我是不是硬體」是那顆元件自己宣告的事實。**
 *
 * ⚠️ 參數是**辨識期記下來的型別**，而那是從概念身分推導的
 * （`cpp:dht_declare` → `'dht'`，見 `core/lift/lifter.ts` 的 `recordDeclaration`）
 * ——**不是** C++ 的型別名。
 */
export function recordedTypeIsDevice(recordedType: string): boolean {
  const suffix = `:${recordedType}_declare`
  for (const c of registeredComponents()) {
    if (c.componentId.endsWith(suffix)) {
      return (c.manifest as { owner?: string }).owner === '(arduino)'
    }
  }
  return false
}
