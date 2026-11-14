/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, isChar, isNarrowInt, isSignedInt, truncatedRemainder, intValue } from '../../../languages/cpp/to-python/contract'

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
      if (rem) return ind(`${py.indent(depth)}${tg.text} = ${rem}`)
      // 64 位元的有號整數、或右邊是運算式（456）：整數運算的小函式，右邊只算一次
      if (isSignedInt(t) && isSignedInt(py.typeOf(value))) return ind(`${py.indent(depth)}${tg.text} = ${py.useTruncDiv('mod')}(${tg.text}, ${py.expr(value)})`)
      return [py.keep(n, 'modulo', t ? `取餘數（型別 ${t}）` : '取餘數要看型別')]
    }
    // 整數的 /=：C++ 向零截斷 ⟹ int(a / b)（不是 //，research R4）；64 位元的保留（spec 224）
    if (op === '/=') {
      if (isNarrowInt(t)) return ind(`${py.indent(depth)}${tg.text} = int(${tg.text} / ${paren(value, py)})`)
      // 64 位元的有號整數（456）：浮點的商超過 2^53 不精確 ⟹ 整數運算的小函式
      if (isSignedInt(t) && isSignedInt(py.typeOf(value))) return ind(`${py.indent(depth)}${tg.text} = ${py.useTruncDiv('div')}(${tg.text}, ${py.expr(value)})`)
      // 浮點的目標：Python 的 /= 同義；其餘（無號、整數除以浮點再截斷）保留
      if (/^(?:double|float|long double)$/.test(t.replace(/^const\s+|\s*&$/g, ''))) return ind(`${py.indent(depth)}${tg.text} /= ${paren(value, py)}`)
      return [py.keep(n, t ? 'division' : 'needs-types', t ? `除法指定（型別 ${t}）還沒有對應` : '除法要看型別')]
    }
    // 位元運算的指定（456）：兩邊都是有號整數時與 C++ 逐位相同（理由同 arithmetic 的 &、|、^、>>）
    if (['&=', '|=', '^=', '>>='].includes(op)) {
      if (isSignedInt(t) && isSignedInt(py.typeOf(value))) return ind(`${py.indent(depth)}${tg.text} ${op} ${py.expr(value)}`)
      return [py.keep(n, 'outside-subset', `運算子 ${op}（型別 ${t || '不明'}、${py.typeOf(value) ?? '不明'}）還沒有對應`)]
    }
    if (!['+=', '-=', '*='].includes(op)) return [py.keep(n, 'outside-subset', `運算子 ${op} 還沒有對應`)]
    // 浮點加進整數（`x += 2.5`）：C++ 算完再截斷回整數（[expr.ass]p7：E1 op= E2 ＝ E1 = E1 op E2）⟹ int(…)；之前寫成 `x += 2.5`、x 變成浮點（450 量到）
    const whole = intValue(t, py.typeOf(value), `${tg.text} ${op[0]} ${paren(value, py)}`)
    if (whole.startsWith('int(')) return ind(`${py.indent(depth)}${tg.text} = ${whole}`)
    return ind(`${py.indent(depth)}${tg.text} ${op} ${py.expr(value)}`)
  })
}
