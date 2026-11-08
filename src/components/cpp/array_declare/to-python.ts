/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = py.name(String(n.properties.name ?? ''))
    const t = String(n.properties.type ?? '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : null
    if (zero === null) return [py.keep(n, 'outside-subset', `${t} 陣列還沒有對應`)]
    const size = n.slots.size?.[0]
    const vals = (n.slots.values ?? []).map((v) => py.expr(v))
    if (!size) return [`${py.indent(depth)}${name} = [${vals.join(', ')}]`]
    if (vals.length === 0) return [`${py.indent(depth)}${name} = [${zero}] * ${paren(size, py)}`]
    // 部分初值（`int a[5] = {1, 2}`）：其餘補 0
    return [`${py.indent(depth)}${name} = [${vals.join(', ')}] + [${zero}] * (${py.expr(size)} - ${vals.length})`]
  })
}
