/**
 * 這顆元件寫成 Python（464）：`vector<T>(n)` → `[0] * n`、`vector<T>(n, x)` → `[x] * n`、`vector<T>()` → `[]`。
 * 元素是數字或字串（Python 裡不能改）⟹ `[x] * n` 每格是同一個值也沒有差別；每次求值都是一個新的 list（二維 vector 每一列各自一個）。
 * 元素型別限 vector 那顆換得過去的幾種；值照元素型別換（`vector<int>(3, 2.5)` 是 2）
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, intValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const t = String(n.properties.type ?? '').replace(/^std::/, '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : /^string$/.test(t) ? '""' : null
    if (zero === null) return py.keep(n, 'outside-subset', `vector<${t}>(…) 還沒有對應`)
    const size = n.slots.size?.[0], fill = n.slots.fill?.[0]
    if (!size) return '[]'
    return `[${fill ? intValue(t, py.typeOf(fill), py.expr(fill)) : zero}] * ${paren(size, py)}`
  })
}
