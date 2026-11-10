/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => [`${cpp.indent(depth)}${paren(n.slots.obj?.[0], cpp)}.push_back(${cpp.expr(n.slots.value?.[0])});`])
}
