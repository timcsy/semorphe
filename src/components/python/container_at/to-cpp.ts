/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const k = n.slots.key?.[0]
    // 負的下標（xs[-1]）在 Python 從後面數、在 C++ 是越界
    if (k?.componentId.endsWith(':negate')) return cpp.keep(n, 'outside-subset', '負的下標（Python 從後面數）')
    const t = cpp.pyType(n.slots.target?.[0])
    if (!t || !/^list\[/.test(t)) return cpp.keep(n, 'type-uncertain', `下標的對象型別（${t ?? '?'}）`)
    return `${paren(n.slots.target?.[0], cpp)}[${cpp.expr(k)}]`
  })
}
