/** `cpp:container_append` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt('cpp:container_append', (n, py, depth) => {
    if (n.properties.method !== 'push_back') return [py.keep(n, 'outside-subset', `.${String(n.properties.method)}(…) 還沒有對應`)]
    return [`${py.indent(depth)}${py.expr(n.slots.obj?.[0])}.append(${py.expr(n.slots.value?.[0])})`]
  })
}
