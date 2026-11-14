/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, isChar, isNarrowInt, isSignedInt, truncatedRemainder } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const op = String(n.properties.operator ?? '')
    const l = n.slots.left?.[0], rr = n.slots.right?.[0]
    // char 參與運算：C++ 的 char 是整數、Python 用長度 1 的字串 ⟹ 那一邊取字碼 ord()，結果是整數（364）
    const side = (x: typeof l): string => (isChar(py.typeOf(x)) ? `ord(${py.expr(x)})` : paren(x, py))
    if (isChar(py.typeOf(l)) || isChar(py.typeOf(rr))) {
      if (op === '%') return py.keep(n, 'modulo', '取餘數：負數時兩個語言的正負號規則不同')
      if (op === '/') return py.keep(n, 'division', 'char 參與的除法')
      if (!['+', '-', '*'].includes(op)) return py.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)
      return `${side(l)} ${op} ${side(rr)}`
    }
    if (op === '%') {
      // 取餘數：C++ 向零截斷、正負號跟被除數（[expr.mul]p4）；Python 的 % 跟除數 ⟹ 照 C++ 的定義寫 a - int(a / b) * b（spec 224）
      const t = py.typeOf(n) ?? ''
      const rem = isNarrowInt(t) ? truncatedRemainder(l, rr, py) : null
      if (rem) return rem  // 外層是運算時由 paren() 加括號（這顆有 left／right 槽）
      // 兩邊有運算式：照定義展開會算兩次 ⟹ 交給一支小函式，每邊只算一次
      if (isNarrowInt(t)) return `${py.useTruncMod()}(${py.expr(l)}, ${py.expr(rr)})`
      // 64 位元的有號整數（456）：浮點的商超過 2^53 不精確 ⟹ 交給整數運算的小函式（商向零截斷，逐位與 C++ 相同）
      if (isSignedInt(t)) return `${py.useTruncDiv('mod')}(${py.expr(l)}, ${py.expr(rr)})`
      return py.keep(n, 'modulo', !t ? '取餘數要看型別' : `取餘數（型別 ${t}）還沒有對應`)
    }
    if (op === '/') {
      const t = py.typeOf(n) ?? ''
      // 整數除法：C++ 向零截斷 ⟹ int(a / b)——32 位元的整數，浮點商在 2^53 以內精確（research R4）；不是 //（向下取整，負數時不同）
      if (isNarrowInt(t)) return `int(${paren(l, py)} / ${paren(rr, py)})`
      // 64 位元的整數（long、long long）：值可以超過 2^53，浮點商不精確——保留（spec 224 順手修）
      // ⟹ 用整數運算的小函式（456）：abs(a) // abs(b) 再補正負號，任何大小都精確
      if (isSignedInt(t)) return `${py.useTruncDiv('div')}(${py.expr(l)}, ${py.expr(rr)})`
      // 無號整數（`sum / v.size()`：int 被轉成 unsigned long）：負數時 C++ 繞回成很大的數（有定義的行為），Python 不會——意思不同，保留
      if (/unsigned|size_t/.test(t)) return py.keep(n, 'division', `無號整數的除法（型別 ${t}）：負數時 C++ 會繞回、Python 不會`)
      if (!t) return py.keep(n, 'needs-types', '除法要看型別（整數除法與浮點除法不同）')
    }
    // 位元運算（456）：兩邊都是有號整數時，Python 的整數是無限長的二補數 ⟹ &、|、^ 的結果與 C++ 逐位相同；
    // `>>` 在 C++20 是算術右移（向負無窮），與 Python 相同（位移量為負或超過寬度是未定義行為，Cella 先判出來）。
    // `<<` 不收：C++ 溢位會繞回（C++20）或未定義，Python 不會；無號整數不收：與負數混用時 C++ 會先轉成無號
    if (['&', '|', '^', '>>'].includes(op)) {
      if (isSignedInt(py.typeOf(l)) && isSignedInt(py.typeOf(rr))) return `${paren(l, py)} ${op} ${paren(rr, py)}`
      return py.keep(n, 'outside-subset', `運算子 ${op}（型別 ${py.typeOf(l) ?? '不明'}、${py.typeOf(rr) ?? '不明'}）還沒有對應`)
    }
    if (!['+', '-', '*', '/'].includes(op)) return py.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)
    return `${paren(l, py)} ${op} ${paren(rr, py)}`
  })
}
