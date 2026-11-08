/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => [`${cpp.indent(depth)}${cpp.expr(n.slots.target?.[0])} = ${cpp.expr(n.slots.value?.[0])};`])
}
