/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = String(n.properties.name ?? '')
    const t = String(n.properties.type ?? '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : /string/.test(t) ? '""' : null
    if (zero === null) return [py.keep(n, 'outside-subset', `vector<${t}> 還沒有對應`)]
    if (n.slots.values?.length) return [`${py.indent(depth)}${name} = [${n.slots.values.map((v) => py.expr(v)).join(', ')}]`]
    if (n.slots.size?.length) return [`${py.indent(depth)}${name} = [${zero}] * ${paren(n.slots.size[0], py)}`]
    if (Object.keys(n.slots).some((k) => k !== 'values' && k !== 'size' && (n.slots[k]?.length ?? 0) > 0)) return [py.keep(n, 'outside-subset', '這種 vector 的建法還沒有對應')]
    return [`${py.indent(depth)}${name} = []`]
  })
}
