/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const t = cpp.pyType(n.slots.obj?.[0])
    if (t !== 'list[int]') return cpp.keep(n, 'type-uncertain', `sum 的對象型別（${t ?? '?'}）`)
    cpp.useInclude('numeric')
    return `accumulate(${cpp.expr(n.slots.obj?.[0])}.begin(), ${cpp.expr(n.slots.obj?.[0])}.end(), 0LL)`
  })
}
