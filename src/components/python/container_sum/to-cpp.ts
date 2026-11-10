/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const t = cpp.pyType(n.slots.obj?.[0])
    if (t !== 'list[int]') return cpp.keep(n, 'type-uncertain', `sum 的對象型別（${t ?? '?'}）`)
    cpp.useInclude('numeric')
    return `accumulate(${paren(n.slots.obj?.[0], cpp)}.begin(), ${paren(n.slots.obj?.[0], cpp)}.end(), 0LL)`
  })
}
