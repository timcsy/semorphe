/**
 * 這顆元件寫成 Python（453）：`auto x = e;` → `x = e`——只收初值是整數／浮點／bool／字串的（Cella 給的型別）。
 * 初值是容器時 C++ 複製一份、Python 是同一個物件（同 447），結構化繫結（`auto [a, b] = …`）照實保留。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

const SCALAR = /^(?:const\s+)?(?:(?:unsigned|signed)\s+)?(?:long long|long double|long|int|short|double|float|bool|(?:std::)?string)(?:\s+int)?\s*&?$/

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = String(n.properties.name ?? '')
    const init = n.slots.initializer?.[0]
    const t = py.typeOf(init) ?? ''
    if (!/^[A-Za-z_]\w*$/.test(name) || !init || !SCALAR.test(t)) return [py.keep(n, 'outside-subset', `auto ${name}（初值型別 ${t || '不明'}）還沒有對應`)]
    return [`${py.indent(depth)}${py.name(name)} = ${py.expr(init)}`]
  })
}
