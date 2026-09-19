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
  /**
   * 🔴 **也要剝掉限定名**（2026-09-18，盲測抓到）：學生寫 `std::pair<int, int>`。
   *
   * 登記的是 `pair`，而不剝的話基底名是 `std::pair`——查不到，於是
   * `v.emplace_back(7, 8)` 說「這個容器的元素不是由 2 個值建起來的」。
   *
   * ⚠️ 症狀只在**寫全名的程式**上出現，而這個 repo 自己的測試幾乎都寫
   * `using namespace std;`——**一個只在別人的寫法上壞掉的缺陷，
   * 自己的語料量不到它。**
   */
  const local = bare.includes('::') ? bare.slice(bare.lastIndexOf('::') + 2) : bare
  return aggregateShapes.get(local.trim())
}

/**
 * 語言套件宣告：「這個**樣板型別**是一排固定長度的格子，長度就是它的樣板引數」。
 *
 * ⚠️ 為什麼需要它：`bitset<26> d[3];` 的每一格必須是**一排 26 個格子**，
 * 而 `defaultValue` 對帶尖括號的型別一律回一個**空容器**
 * ——於是 `d[0][2] = 1` 說「索引 2 超出範圍」（因為那一格是空的）。
 *
 * 🔴 判準與它隔壁那張（聚合形狀）同一條：**問登記處，不問型別名**。
 * 核心不寫死 `bitset`——**它是 C++ 的知識**。
 *
 * > **「帶尖括號」說的是它是一個樣板，不是它是一個容器。**（隔壁那條的原話）
 */
const sizedRows = new Map<string, string>()

/**
 * @param typeName 樣板名（登記 `bitset`，不是 `bitset<26>`）
 * @param elemType 每一格的元素型別章——位元運算子靠它分辨「一排位元」與「一個 vector」
 */
export function declareSizedRowType(typeName: string, elemType: string): void {
  sizedRows.set(typeName, elemType)
}

/** 這個型別是一排固定長度的格子嗎；是的話回元素型別章。認不得回 `undefined`——不猜。 */
export function sizedRowElemType(typeName: string): string | undefined {
  const bare = typeName.includes('<') ? typeName.slice(0, typeName.indexOf('<')) : typeName
  // ⚠️ 限定名也要剝——學生寫 `std::bitset<26>`（隔壁那張踩過，盲測抓到的）
  const local = bare.includes('::') ? bare.slice(bare.lastIndexOf('::') + 2) : bare
  return sizedRows.get(local.trim())
}

/** 護欄用：誰被宣告過。 */
/**
 * **這個範圍（語言）的「大括號串列」元件是誰。**
 *
 * 🔴 它存在的理由是**膠囊就近性**（2026-09-16）：組裝路徑需要生一顆
 * 「大括號串列」節點，而它**不得寫死 `cpp:initializer_list`**
 * ——一個元件的身分只准住在自己的資料夾裡，寫死在共用檔就是第二份宣告。
 *
 * > **共用檔可以【問】哪一顆是，不可以【說】哪一顆是。**
 */
export function aggregateListFor(scope: string): string | undefined {
  const prefix = `${scope}:`
  for (const id of aggregateLists) if (id.startsWith(prefix)) return id
  return undefined
}

export function declaredAggregateLists(): string[] {
  return [...aggregateLists]
}
