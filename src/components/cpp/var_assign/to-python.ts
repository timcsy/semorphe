/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar, intValue, keyedKind, writeTo, sameType, adapterKind } from '../../../languages/cpp/to-python/contract'

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
    const tg = py.target(target, false)
    if (/^(const\s+)?(std::)?(vector|stack)</.test(py.typeOf(target) ?? '')) return [`${py.indent(depth)}${writeTo(tg, `list(${py.expr(value)})`)}`]
    // queue／std::deque（475，collections.deque）同理 ⟹ collections.deque(…)
    const ak = adapterKind(py.typeOf(target))
    if (ak === 'queue' || ak === 'deque') return [`${py.indent(depth)}${writeTo(tg, `${py.useImport('collections')}.deque(${py.expr(value)})`)}`]
    // map／set 同理（450）⟹ dict(…)／set(…)
    const keyed = keyedKind(py.typeOf(target))
    if (keyed) return [`${py.indent(depth)}${writeTo(tg, `${keyed.kind === 'map' ? 'dict' : 'set'}(${py.expr(value)})`)}`]
    // 目標的型別先問 Cella，沒給就問宣告那一顆記下的（462：Cella 不給指定目標的型別 ⟹ `b = n - 4` 放進 bool 原樣存 2）
    const bare = target && Object.keys(target.slots ?? {}).length === 0 && typeof target.properties?.name === 'string'
    const tt = py.typeOf(target) ?? tg.type ?? (bare ? py.varTypeOf(String(target.properties.name)) : undefined)
    // pair（465，換成 tuple）：整個指定只收型別一模一樣的值——`p = make_pair(1, 2.5)` 放進 pair<int,int> 要逐格截斷，不猜
    if (/^(std::)?pair\s*</.test(tt ?? '') && !sameType(tt, py.typeOf(value))) return [py.keep(n, 'needs-types', `放進 ${tt} 的值型別是 ${py.typeOf(value) ?? '不知道'}`)]
    // 都不知道而值是浮點：可能要截斷（同 array_assign，459）——保留，不猜（462 量到：兩個函式各有一個 k、一個 int 一個 double）
    if (tt === undefined && /^(const\s+)?(double|float|long double)/.test(py.typeOf(value) ?? '')) return [py.keep(n, 'needs-types', `放進 ${py.expr(target)} 的值是浮點，而不知道 ${py.expr(target)} 的型別`)]
    return [`${py.indent(depth)}${writeTo(tg, intValue(tt, py.typeOf(value), py.expr(value)))}`]
  })
}
