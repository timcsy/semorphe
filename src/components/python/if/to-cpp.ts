/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    if ((n.slots.elif_condition ?? []).length > 0) return [cpp.keep(n, 'outside-subset', 'elif 還沒有對應')]
    const i = cpp.indent(depth)
    const out = [`${i}if (${cpp.expr(n.slots.condition?.[0])}) {`, ...cpp.block(n.slots.body, depth + 1)]
    if ((n.slots.else_body ?? []).length > 0) out.push(`${i}} else {`, ...cpp.block(n.slots.else_body, depth + 1))
    out.push(`${i}}`)
    return out
  })
}
