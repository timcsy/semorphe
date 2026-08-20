/**
 * **聚合初始化的執行語義** —— 一個與身分無關的演算法
 *
 * `{…}` 在辨識那一路是一個結構節點（不是元件），
 * 而**執行那一路從來沒有人認得它**：`S arr[2] = {{"a",90},{"b",80}};`
 * 直接丟 `UNKNOWN_CONCEPT`，`int a[2][3] = {{1,2,3},{4,5,6}}` 也一樣。
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
import type { RuntimeValue } from './types'
import type { SemanticNode } from '../core/types'
import type { ExecutionContext } from './executor-registry'
import { isAggregateList, aggregateShapeOf } from '../core/component/aggregate-nodes'

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
export async function evalInitializer(
  node: SemanticNode,
  type: string,
  ctx: ExecutionContext,
): Promise<RuntimeValue> {
  if (!isBraceList(node)) return ctx.coerceType(await ctx.evaluate(node), type)

  const elements = node.children.values ?? []

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
    const fields = new Map<string, RuntimeValue>()
    for (let i = 0; i < shape.length; i++) {
      const el = elements[i]
      fields.set(shape[i], el ? await evalInitializer(el, 'int', ctx) : { type: 'int', value: 0 })
    }
    return { type: 'object', value: fields, structName: type.includes('<') ? type.slice(0, type.indexOf('<')) : type }
  }

  // 其他 → 一個陣列值（多維陣列的內層走這條）
  const values: RuntimeValue[] = []
  for (const el of elements) values.push(await evalInitializer(el, type, ctx))
  return { type: 'array', value: values }
}
