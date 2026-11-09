/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const i = cpp.indent(depth)
    const out = [`${i}if (${cpp.expr(n.slots.condition?.[0])}) {`, ...cpp.block(n.slots.body, depth + 1)]
    // elif：條件與主體是兩個靠索引配對的清單；一支的主體可以是「一段」（_compound）
    const elifBodies = n.slots.elif_body ?? []
    ;(n.slots.elif_condition ?? []).forEach((c, k) => {
      const b = elifBodies[k]
      out.push(`${i}} else if (${cpp.expr(c)}) {`, ...cpp.block(b?.componentId === '_compound' ? b.slots.body : b ? [b] : [], depth + 1))
    })
    if ((n.slots.else_body ?? []).length > 0) out.push(`${i}} else {`, ...cpp.block(n.slots.else_body, depth + 1))
    out.push(`${i}}`)
    return out
  })
}
