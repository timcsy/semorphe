/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // input() 讀一整行（research R6）；有提示字串的 input("…") 會先印提示——第一版保留
  r.expr((n, cpp) => ((n.slots.prompt ?? []).length > 0 ? cpp.keep(n, 'outside-subset', 'input 帶提示字串') : `${cpp.useHelper('read_line')}()`))
}
