/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => (cpp.pyType(n.slots.value?.[0]) === 'bool' ? `!${paren(n.slots.value?.[0], cpp)}` : cpp.keep(n, 'type-uncertain', 'not 的對象不是 bool')))
}
