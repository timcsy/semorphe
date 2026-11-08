/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const op = String(n.properties.operator ?? '')
    if (!['==', '!=', '<', '>', '<=', '>='].includes(op)) return cpp.keep(n, 'outside-subset', `比較運算子 ${op} 還沒有對應`)
    const tl = cpp.pyType(n.slots.left?.[0]), tr = cpp.pyType(n.slots.right?.[0])
    const num = (t: string | undefined) => t === 'int' || t === 'float' || t === 'bool'
    if (!((num(tl) && num(tr)) || (tl === 'str' && tr === 'str'))) return cpp.keep(n, 'type-uncertain', `比較的兩邊型別（${tl ?? '?'}、${tr ?? '?'}）`)
    return `${paren(n.slots.left?.[0], cpp)} ${op} ${paren(n.slots.right?.[0], cpp)}`
  })
}
