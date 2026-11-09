/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const op = String(n.properties.operator ?? '')
    // Python 的 and／or 回傳運算元本身（不一定是 bool）——兩邊都是 bool 才換
    if (cpp.pyType(n.slots.left?.[0]) !== 'bool' || cpp.pyType(n.slots.right?.[0]) !== 'bool') return cpp.keep(n, 'type-uncertain', `${op} 的兩邊不是 bool（Python 會回傳運算元本身）`)
    if (op === 'and') return `${paren(n.slots.left?.[0], cpp)} && ${paren(n.slots.right?.[0], cpp)}`
    if (op === 'or') return `${paren(n.slots.left?.[0], cpp)} || ${paren(n.slots.right?.[0], cpp)}`
    return cpp.keep(n, 'outside-subset', `邏輯運算子 ${op} 還沒有對應`)
  })
}
