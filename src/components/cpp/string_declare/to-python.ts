/** `cpp:string_declare` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt('cpp:string_declare', (n, py, depth) => {
    const init = n.slots.initializer?.[0]
    return [`${py.indent(depth)}${String(n.properties.name ?? '')} = ${init ? py.expr(init) : '""'}`]
  })
}
