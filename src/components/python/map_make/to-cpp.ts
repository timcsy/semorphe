/** 這顆元件寫成 C++（405；有內容的字面量 441）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

/** 鍵是字面量時的身分（同一個值 ⟹ 同一個鍵）；不是字面量 → undefined */
const literalKey = (k: SemanticNode | undefined): string | undefined =>
  k && /:(literal_string|literal_number)$/.test(k.componentId) ? `${k.componentId.split(':')[1]}:${String(k.properties?.value)}` : undefined

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const pairs = n.slots.pairs ?? []
    // {}：空的 map（型別由宣告那一行給）
    if (pairs.length === 0) return '{}'
    // 有內容的字面量：重複的鍵 Python 取後面那個、C++ 的初始化串列取前面那個——只收鍵都是【不重複的字面量】的；
    // 大括號只在 `x = {…}` 的右邊寫得成 C++
    const keys = pairs.map((p) => literalKey(p.slots?.key?.[0]))
    if (!cpp.assignedValue(n) || keys.some((k) => k === undefined) || new Set(keys).size !== keys.length) {
      return cpp.keep(n, 'outside-subset', '有內容的字典字面量：鍵要是不重複的字面量、而且寫在 x = {…} 的右邊')
    }
    return `{${pairs.map((p) => `{${cpp.expr(p.slots?.key?.[0])}, ${cpp.expr(p.slots?.value?.[0])}}`).join(', ')}}`
  })
}
