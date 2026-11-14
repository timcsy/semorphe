/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `i++;`／`i--;` 當敘述 → i += 1
  r.stmt((n, py, depth) => {
    // char 的 ++（下一個字元）：Python 的字串不能加 1——保留（364）
    if (isChar(py.typeOf(n.slots.target?.[0]))) return [py.keep(n, 'char', 'char 的 ++／--')]
    const tg = py.target(n.slots.target?.[0], true)
    return [...(tg.before ? [`${py.indent(depth)}${tg.before}`] : []), `${py.indent(depth)}${tg.text} ${n.properties.operator === '--' ? '-=' : '+='} 1`]
  })
  // 當運算式（`a[idx++] = b[j++]`、`j = ++i`；457）：Python 沒有 ++ ⟹ 拆成這一句後面（後置）或前面（前置）的 `x += 1`，
  // 運算式的位置寫 `x` 本身。拆不拆得開由引擎判（py.hoist 的條件）；對象只收一個變數（`a[k]++` 當運算式保留）
  r.expr((n, py) => {
    const x = n.slots.target?.[0]
    if (isChar(py.typeOf(x))) return py.keep(n, 'char', 'char 的 ++／--')
    if (!x || typeof x.properties?.name !== 'string' || Object.values(x.slots ?? {}).some((k) => k.length > 0)) {
      return py.keep(n, 'outside-subset', '運算式裡的 ++／-- 的對象不是一個變數')
    }
    const name = py.expr(x)
    const line = `${name} ${n.properties.operator === '--' ? '-=' : '+='} 1`
    return py.hoist(n, x.properties.name, line, n.properties.position === 'prefix' ? 'before' : 'after') ? name : '…'
  })
}
