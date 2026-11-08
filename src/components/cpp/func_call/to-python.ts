/** `cpp:func_call` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr('cpp:func_call', (n, py) => {
    const name = String(n.properties.name ?? '')
    if (!py.isUserFunction(name)) return py.keep(n, 'outside-subset', `標準函式庫的 ${name}(…) 還沒有對應`)
    return `${name}(${(n.slots.args ?? []).map((a) => py.expr(a)).join(', ')})`
  })
}
