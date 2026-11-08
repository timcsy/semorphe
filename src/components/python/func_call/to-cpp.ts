/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // 程式自己定義的函式照名字呼叫；內建函式各有自己的元件（len、max…），這裡碰到的其餘的保留
  r.expr((n, cpp) => {
    const name = String(n.properties.name ?? '')
    if (!cpp.isUserFunction(name)) return cpp.keep(n, 'outside-subset', `呼叫 ${name}(…) 還沒有對應`)
    return `${cpp.name(name)}(${(n.slots.args ?? []).map((a) => cpp.expr(a)).join(', ')})`
  })
}
