/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const i = cpp.indent(depth)
    // 迴圈的 `else:`（沒遇到 break 才做）在 C++ 沒有一對一的寫法——照實留著，不猜（第 417 刀）
    if ((n.slots.else_body ?? []).length > 0) return [cpp.keep(n, 'outside-subset', '迴圈的 else（沒被 break 才做）還沒有對應')]
    return [`${i}while (${cpp.expr(n.slots.condition?.[0])}) {`, ...cpp.block(n.slots.body, depth + 1), `${i}}`]
  })
}
