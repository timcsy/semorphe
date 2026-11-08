/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { cppString } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // 字串字面量當運算式：string("…")——讓 + 串接走 std::string（兩個字面量相加在 C++ 不合法）
  r.expr((n) => `string(${cppString(String(n.properties.value ?? ''))})`)
}
