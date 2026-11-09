/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const op = String(n.properties.operator ?? '')
    const l = n.slots.left?.[0], rr = n.slots.right?.[0]
    const tl = cpp.pyType(l), tr = cpp.pyType(rr)
    const ints = tl === 'int' && tr === 'int'
    if (op === '/') {
      // Python 的 / 永遠是浮點除法
      if ((tl === 'int' || tl === 'float') && (tr === 'int' || tr === 'float')) return `(double)${paren(l, cpp)} / ${paren(rr, cpp)}`
      return cpp.keep(n, 'needs-types', '除法要看兩邊的型別')
    }
    if (op === '//' || op === '%') {
      // 整數：向下取整（Python）與向零截斷（C++）不同 ⟹ 補一支小函式（research R4）
      if (ints) return `${cpp.useHelper(op === '//' ? 'floor_div' : 'floor_mod')}(${cpp.expr(l)}, ${cpp.expr(rr)})`
      return cpp.keep(n, op === '//' ? 'division' : 'modulo', `${op} 的兩邊不是整數（${tl ?? '?'}、${tr ?? '?'}）`)
    }
    if (op === '+' && tl === 'str' && tr === 'str') return `${paren(l, cpp)} + ${paren(rr, cpp)}`
    if (['+', '-', '*'].includes(op)) {
      const num = (t: string | undefined) => t === 'int' || t === 'float'
      if (num(tl) && num(tr)) return `${paren(l, cpp)} ${op} ${paren(rr, cpp)}`
      return cpp.keep(n, 'outside-subset', `${tl ?? '?'} ${op} ${tr ?? '?'} 還沒有對應`)
    }
    return cpp.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)
  })
}
