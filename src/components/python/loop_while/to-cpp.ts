/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const i = cpp.indent(depth)
    return [`${i}while (${cpp.expr(n.slots.condition?.[0])}) {`, ...cpp.block(n.slots.body, depth + 1), `${i}}`]
  })
}
