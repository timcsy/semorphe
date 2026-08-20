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

/** 語言套件宣告：「這個 componentId 的節點是一層聚合初始化列」。 */
export function declareAggregateList(componentId: string): void {
  aggregateLists.add(componentId)
}

/** 這個節點是不是一層 `{…}`。沒有人宣告過就是 `false`——不猜。 */
export function isAggregateList(componentId: string): boolean {
  return aggregateLists.has(componentId)
}

/**
 * 語言套件宣告：「這個**型別**的聚合初始化按這些欄位依序填」。
 *
 * ⚠️ 為什麼需要它：`pair` 不是使用者宣告的結構，所以它不在 `structs` 登記處裡
 * ——而 `vector<pair<int,int>> v; v.push_back({2,1})` 的 `{2,1}` 必須變成
 * 一個有 `first`／`second` 的東西，否則 `v[0].first` 說「不是一個結構」。
 *
 * 核心不寫死 `pair` 這個名字：**它是 C++ 的知識**。
 */
const aggregateShapes = new Map<string, string[]>()

export function declareAggregateShape(typeName: string, fields: string[]): void {
  aggregateShapes.set(typeName, fields)
}

/**
 * 這個型別的聚合欄位。認不得回 `undefined`——不猜。
 *
 * ⚠️ **剝掉樣板引數**：登記的是 `pair`，而型別字串是 `pair<int,int>`。
 * 那與 `execVarDeclare` 查結構型別時做的是同一件事。
 */
export function aggregateShapeOf(typeName: string): string[] | undefined {
  const bare = typeName.includes('<') ? typeName.slice(0, typeName.indexOf('<')) : typeName
  return aggregateShapes.get(bare.trim())
}

/** 護欄用：誰被宣告過。 */
export function declaredAggregateLists(): string[] {
  return [...aggregateLists]
}
