/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, isChar, isNarrowInt, truncatedRemainder } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const op = String(n.properties.operator ?? '')
    const target = n.slots.target?.[0]
    const value = n.slots.value?.[0]
    const t = py.typeOf(target) ?? ''
    if (isChar(t)) return [py.keep(n, 'char', `char 的 ${op}`)]
    // 取餘數：同 `a % b`（spec 224）——int(math.fmod(x, v))，只收 32 位元以內的整數
    if (op === '%=') {
      const rem = isNarrowInt(t) ? truncatedRemainder(target, value, py) : null
      return rem ? [`${py.indent(depth)}${py.expr(target)} = ${rem}`] : [py.keep(n, 'modulo', t ? `取餘數（型別 ${t}）` : '取餘數要看型別')]
    }
    // 整數的 /=：C++ 向零截斷 ⟹ int(a / b)（不是 //，research R4）；64 位元的保留（spec 224）
    if (op === '/=') return isNarrowInt(t) ? [`${py.indent(depth)}${py.expr(target)} = int(${py.expr(target)} / ${paren(value, py)})`] : t ? [`${py.indent(depth)}${py.expr(target)} /= ${paren(value, py)}`] : [py.keep(n, 'needs-types', '除法要看型別')]
    if (!['+=', '-=', '*='].includes(op)) return [py.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)]
    return [`${py.indent(depth)}${py.expr(target)} ${op} ${py.expr(value)}`]
  })
}
