/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // 宣告已由引擎提到函式最前面（research R2）——這裡只是指定
  r.stmt((n, cpp, depth) => [`${cpp.indent(depth)}${cpp.name(String(n.properties.obj ?? ''))} = ${cpp.expr(n.slots.value?.[0])};`])
}
