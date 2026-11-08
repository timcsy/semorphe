/** `cpp:builtin_constant` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr('cpp:builtin_constant', (n, py) => {
    const v = String(n.properties.value ?? '')
    if (v === 'true') return 'True'
    if (v === 'false') return 'False'
    return py.keep(n, 'outside-subset', `常數 ${v} 還沒有對應`)
  })
}
