/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar, intValue, keyedKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const target = n.slots.target?.[0]
    const value = n.slots.value?.[0]
    if (isChar(py.typeOf(target))) {
      // 字串裡的一個字元（`s[i] = …`）：Python 的字串不能改——保留（問形狀：目標有 index 槽）
      if (target?.slots?.index) return [py.keep(n, 'char', '改字串裡的一個字元：C++ 的字串可以改、Python 的字串不能')]
      // char 變數：值是整數 ⟹ chr()（364）
      const v = isChar(py.typeOf(value)) || value?.properties?.char !== undefined ? py.expr(value) : `chr(${py.expr(value)})`
      return [`${py.indent(depth)}${py.expr(target)} = ${v}`]
    }
    // vector／stack（448）的指定是複製（C++ 的 `b = a` 之後兩個各自獨立）；Python 的 `b = a` 是同一個 list ⟹ 寫成 `list(a)`（447：之前換出來改 b 會改到 a）
    const tgt = py.target(target, false).text
    if (/^(const\s+)?(std::)?(vector|stack)</.test(py.typeOf(target) ?? '')) return [`${py.indent(depth)}${tgt} = list(${py.expr(value)})`]
    // map／set 同理（450）⟹ dict(…)／set(…)
    const keyed = keyedKind(py.typeOf(target))
    if (keyed) return [`${py.indent(depth)}${tgt} = ${keyed.kind === 'map' ? 'dict' : 'set'}(${py.expr(value)})`]
    return [`${py.indent(depth)}${tgt} = ${intValue(py.typeOf(target), py.typeOf(value), py.expr(value))}`]
  })
}
