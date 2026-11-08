/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const op = String(n.properties.operator ?? '')
    const target = n.slots.target?.[0]
    const value = n.slots.value?.[0]
    const t = py.typeOf(target) ?? ''
    if (isChar(t)) return [py.keep(n, 'char', `char 的 ${op}`)]
    if (op === '%=') return [py.keep(n, 'modulo', '取餘數：負數時兩個語言的正負號規則不同')]
    // 整數的 /=：C++ 向零截斷 ⟹ int(a / b)（不是 //，research R4）
    if (op === '/=') return /^(int|long|long long|short)$/.test(t) ? [`${py.indent(depth)}${py.expr(target)} = int(${py.expr(target)} / ${paren(value, py)})`] : t ? [`${py.indent(depth)}${py.expr(target)} /= ${paren(value, py)}`] : [py.keep(n, 'needs-types', '除法要看型別')]
    if (!['+=', '-=', '*='].includes(op)) return [py.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)]
    return [`${py.indent(depth)}${py.expr(target)} ${op} ${py.expr(value)}`]
  })
}
