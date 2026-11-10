/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => `${paren(n.slots.obj?.[0], py)}[${py.expr(n.slots.row?.[0])}][${py.expr(n.slots.col?.[0])}]`)
}
