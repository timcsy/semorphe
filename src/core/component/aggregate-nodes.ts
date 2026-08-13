/**
 * 「哪些節點是**聚合初始化列**」的登記處——核心給機制，套件給資料。
 *
 * ## 為什麼不是一個字串比對
 *
 * 聚合初始化（`{1, 2, 3}`）的**執行語義是中立的**：按目標型別決定它變成
 * 一個結構實例還是一串值——那段演算法用得到的只有 `ctx.structs`，
 * 沒有一個字是 C++ 的。
 *
 * 而「`cpp_initializer_list` 這個節點是一層 `{…}`」**是 C++ 的知識**。
 * 兩者混在一起的話，核心的 `variables.ts` 就得寫死一個 C++ 的名字
 * ——而中立性護欄看的正是這個。
 *
 * > **問角色，不問身分。**（`executors/structs.ts` 的 `memberRoleOf` 同一條）
 *
 * ⚠️ 這張表是**空的**，資料由語言套件在註冊 lifter 時推進來。
 */

const aggregateLists = new Set<string>()

/** 語言套件宣告：「這個 conceptId 的節點是一層聚合初始化列」。 */
export function declareAggregateList(conceptId: string): void {
  aggregateLists.add(conceptId)
}

/** 這個節點是不是一層 `{…}`。沒有人宣告過就是 `false`——不猜。 */
export function isAggregateList(conceptId: string): boolean {
  return aggregateLists.has(conceptId)
}

/** 護欄用：誰被宣告過。 */
export function declaredAggregateLists(): string[] {
  return [...aggregateLists]
}
