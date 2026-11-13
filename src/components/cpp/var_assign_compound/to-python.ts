/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, isChar, isNarrowInt, truncatedRemainder, intValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const op = String(n.properties.operator ?? '')
    const target = n.slots.target?.[0]
    const value = n.slots.value?.[0]
    const t = py.typeOf(target) ?? ''
    if (isChar(t)) return [py.keep(n, 'char', `char 的 ${op}`)]
    // 目標先讀再改（450：map 的元素要先補上預設值）——之後各分支用 tgt 寫目標、ind 接在 before 後面
    const tg = py.target(target, true)
    const ind = (line: string): string[] => [...(tg.before ? [`${py.indent(depth)}${tg.before}`] : []), line]
    // 取餘數：同 `a % b`（spec 224）——int(math.fmod(x, v))，只收 32 位元以內的整數
    if (op === '%=') {
      const rem = isNarrowInt(t) ? truncatedRemainder(target, value, py) : null
      return rem ? ind(`${py.indent(depth)}${tg.text} = ${rem}`) : [py.keep(n, 'modulo', t ? `取餘數（型別 ${t}）` : '取餘數要看型別')]
    }
    // 整數的 /=：C++ 向零截斷 ⟹ int(a / b)（不是 //，research R4）；64 位元的保留（spec 224）
    if (op === '/=') return isNarrowInt(t) ? ind(`${py.indent(depth)}${tg.text} = int(${tg.text} / ${paren(value, py)})`) : t ? ind(`${py.indent(depth)}${tg.text} /= ${paren(value, py)}`) : [py.keep(n, 'needs-types', '除法要看型別')]
    if (!['+=', '-=', '*='].includes(op)) return [py.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)]
    // 浮點加進整數（`x += 2.5`）：C++ 算完再截斷回整數（[expr.ass]p7：E1 op= E2 ＝ E1 = E1 op E2）⟹ int(…)；之前寫成 `x += 2.5`、x 變成浮點（450 量到）
    const whole = intValue(t, py.typeOf(value), `${tg.text} ${op[0]} ${paren(value, py)}`)
    if (whole.startsWith('int(')) return ind(`${py.indent(depth)}${tg.text} = ${whole}`)
    return ind(`${py.indent(depth)}${tg.text} ${op} ${py.expr(value)}`)
  })
}
