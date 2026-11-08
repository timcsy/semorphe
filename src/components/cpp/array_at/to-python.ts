/** `cpp:array_at` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr('cpp:array_at', (n, py) => `${py.expr(n.slots.obj?.[0])}[${py.expr(n.slots.index?.[0])}]`)
}
