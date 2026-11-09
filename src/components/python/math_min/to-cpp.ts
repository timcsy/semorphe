/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { extreme } from '../math_max/to-cpp'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => extreme(n, cpp, 'min'))
}
