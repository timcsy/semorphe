/** `cpp:var_ref` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr('cpp:var_ref', (n, py) => {
    const name = String(n.properties.name ?? '')
    if (name.includes('::')) return py.keep(n, 'outside-subset', `限定名 ${name} 還沒有對應`)
    return name
  })
}
