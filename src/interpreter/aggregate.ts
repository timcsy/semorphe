/**
 * **聚合初始化的執行語義** —— 一個與身分無關的演算法
 *
 * `{…}` 在辨識那一路是一個結構節點（不是元件），
 * 而**執行那一路從來沒有人認得它**：`S arr[2] = {{"a",90},{"b",80}};`
 * 直接丟 `UNKNOWN_COMPONENT`，`int a[2][3] = {{1,2,3},{4,5,6}}` 也一樣。
 *
 * 三種消費者（陣列宣告、變數宣告、未來的回傳值）看到的是同一件事。
 *
 * ⚠️ **這段演算法是中立的**：它用得到的只有 `ctx.structs`，沒有一個字是 C++ 的
 * ——所以它住在核心，而「哪個節點是一層 `{…}`」由語言套件宣告。
 *
 * ## 它決定「這一層 `{}` 是什麼」的規則
 *
 * | 目標型別 | `{a, b, c}` 變成 |
 * |---|---|
 * | 已登記的結構／類別 | 一個實例，值**按成員宣告順序**填（C++ 的聚合初始化） |
 * | 其他 | 一個陣列值——多維陣列的內層就是這條 |
 *
 * ⚠️ **不做的**：narrowing 檢查、指名初始化（`.x = 1`）、
 * 少於欄位數時的零值補齊以外的規則。少寫比寫錯好。
 */
import { defaultValue, type RuntimeValue } from './types'
import type { SemanticNode } from '../core/types'
import type { ExecutionContext } from './executor-registry'
import { isAggregateList, aggregateShapeOf } from '../core/component/aggregate-nodes'
import { hasAlias, resolveAlias } from './aliases'

/**
 * 這個節點是不是一層 `{…}`。
 *
 * ⚠️ **問登記處，不比對名字**——`cpp_initializer_list` 是 C++ 的知識，
 * 而這個檔住在核心。語言套件在註冊 lifter 時宣告（`declareAggregateList`）。
 */
export function isBraceList(node: SemanticNode): boolean {
  return isAggregateList(node.componentId)
}

/**
 * 求一個初始值的值，`{…}` 依 `type` 展開。
 *
 * 非 `{…}` 的節點原樣求值再轉型——所以呼叫端可以無條件走這一支，
 * 不必自己判斷是不是聚合。
 */
/**
 * `pair<string, int>` → `['string', 'int']`。
 *
 * ⚠️ **在最外層的逗號切**——`map<int, vector<pair<int,int>>>` 的第二個引數
 * 自己就帶著逗號。數不對就回空陣列（讓呼叫端落回預設），**不猜**。
 */
function fieldTypesOf(type: string, want: number): string[] {
  const lt = type.indexOf('<')
  if (lt === -1) return []
  const inner = type.slice(lt + 1, type.lastIndexOf('>'))
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of inner) {
    if (ch === '<') depth++
    else if (ch === '>') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out.length === want ? out : []
}

export async function evalInitializer(
  node: SemanticNode,
  written: string,
  ctx: ExecutionContext,
): Promise<RuntimeValue> {
  /**
   * 🔴 **型別名可能是一個別名**（2026-09-20，語料 `AP325/4/4_15_3t.cpp`）。
   *
   * ```cpp
   * #define pii pair<int,int>
   * multiset<pii> st;  st.insert({3,4});  →  iter->second 說「不是一個結構」
   * ```
   *
   * 容器把元素型別**照學生寫的字串**記下來（那是對的——產回去要一字不差），
   * 而底下每一張表查的都是真名：`ctx.structs`、`aggregateShapeOf`、樣板引數。
   * 別名在三張表裡都查不到，於是 `{3,4}` 變成一串普通的格子，
   * **錯誤要等到有人讀它的欄位才出現**。
   *
   * ⚠️ **這裡是匯流點**：十幾顆容器各自把 `elemType` 記下來，而它們最後都
   * 走到這一支來把 `{…}` 變成一個值。在這裡解一次，勝過在十幾個記錄點各解一次
   * ——而後者的下一顆容器又會忘記。
   *
   * > **一張別名表如果要每一個消費者記得查它，
   * > 那它保護的是查過的那幾個，不是那一族。**
   */
  const type = hasAlias(written) ? resolveAlias(written) : written
  if (!isBraceList(node)) return ctx.coerceType(await ctx.evaluate(node), type)

  const elements = node.slots.values ?? []

  // 結構／類別 → 聚合初始化：按**成員宣告順序**填
  if (ctx.structs.has(type)) {
    const obj = ctx.structs.instantiate(type)
    if (obj.type === 'object') {
      const fields = ctx.structs.fieldsOf(type)
      const map = obj.value as Map<string, RuntimeValue>
      for (let i = 0; i < elements.length && i < fields.length; i++) {
        map.set(fields[i].name, await evalInitializer(elements[i], fields[i].type, ctx))
      }
    }
    return obj
  }

  // 語言套件宣告過形狀的內建型別（`pair`）→ 依宣告的欄位順序填。
  // ⚠️ 它們不在 `structs` 裡，因為使用者沒有宣告過它們。
  const shape = aggregateShapeOf(type)
  if (shape) {
    /**
     * 🔴 **每一格的型別要從樣板引數拆出來**（2026-09-18，盲測抓到）。
     *
     * 這裡本來對每一格都寫死 `'int'`，於是
     * `priority_queue<pair<string,int>> ps; ps.push({"a", 9});`
     * 的 `"a"` 被 `coerceType(…, 'int')` **壓成 0**——印出來是 `09`。
     *
     * ⚠️ 它一直沒被發現，是因為在型別字串帶著限定名（`std::pair<…>`）時
     * 這條分支**根本不會進來**（基底名查不到）——**一個缺陷躲在另一個缺陷後面，
     * 而修好上面那個的當天它才第一次執行。**
     *
     * > **一段「從來沒有被走到」的程式碼，與一段正確的程式碼長得一模一樣。**
     */
    const args = fieldTypesOf(type, shape.length)
    const fields = new Map<string, RuntimeValue>()
    for (let i = 0; i < shape.length; i++) {
      const el = elements[i]
      const ft = args[i] ?? 'int'
      fields.set(shape[i], el ? await evalInitializer(el, ft, ctx) : defaultValue(ft))
    }
    return { type: 'object', value: fields, structName: type.includes('<') ? type.slice(0, type.indexOf('<')) : type }
  }

  // 其他 → 一個陣列值（多維陣列的內層走這條）
  const values: RuntimeValue[] = []
  for (const el of elements) values.push(await evalInitializer(el, type, ctx))
  return { type: 'array', value: values }
}
