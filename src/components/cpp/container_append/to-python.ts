/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    if (n.properties.method !== 'push_back') return [py.keep(n, 'outside-subset', `.${String(n.properties.method)}(…) 還沒有對應`)]
    return [`${py.indent(depth)}${paren(n.slots.obj?.[0], py)}.append(${py.expr(n.slots.value?.[0])})`]
  })
}
