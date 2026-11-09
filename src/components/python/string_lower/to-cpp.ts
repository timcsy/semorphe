/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => `${cpp.useHelper('to_lower')}(${cpp.expr(n.slots.obj?.[0])})`)
}
