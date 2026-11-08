/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => `${py.expr(n.slots.obj?.[0])}[${py.expr(n.slots.row?.[0])}][${py.expr(n.slots.col?.[0])}]`)
}
