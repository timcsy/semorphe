/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar, intValue } from '../../../languages/cpp/to-python/contract'

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
    // vector 的指定是複製（C++ 的 `b = a` 之後兩個各自獨立）；Python 的 `b = a` 是同一個 list ⟹ 寫成 `list(a)`（447：之前換出來改 b 會改到 a）
    if (/^(const\s+)?(std::)?vector</.test(py.typeOf(target) ?? '')) return [`${py.indent(depth)}${py.expr(target)} = list(${py.expr(value)})`]
    return [`${py.indent(depth)}${py.expr(target)} = ${intValue(py.typeOf(target), py.typeOf(value), py.expr(value))}`]
  })
}
