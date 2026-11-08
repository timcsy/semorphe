/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // len(xs)：Python 回傳 int（有號）；size() 是無號——轉成 long long，與負數比較時才不會繞回
  r.expr((n, cpp) => `(long long)${cpp.expr(n.slots.obj?.[0])}.size()`)
}
