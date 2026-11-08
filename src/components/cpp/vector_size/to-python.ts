/** `cpp:vector_size` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr('cpp:vector_size', (n, py) => `len(${py.expr(n.slots.obj?.[0])})`)
}
