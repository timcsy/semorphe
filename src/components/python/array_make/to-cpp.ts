/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // [a, b] → {a, b}（指定給已宣告的 vector）；元素型別由宣告那一側決定
  r.expr((n, cpp) => `{${(n.slots.items ?? []).map((x) => cpp.expr(x)).join(', ')}}`)
}
