/** 這顆元件寫成 C++（405）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // {}：空的 map（型別由宣告那一行給）。有內容的字面量：重複的鍵 Python 取後面那個、C++ 的初始化串列取前面那個——先不換
  r.expr((n, cpp) => ((n.slots.pairs ?? []).length === 0 ? '{}' : cpp.keep(n, 'outside-subset', '有內容的字典字面量還沒有對應')))
}
