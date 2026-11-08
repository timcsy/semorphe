/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => [`${py.indent(depth)}while ${py.expr(n.slots.condition?.[0])}:`, ...py.block(n.slots.body, depth + 1)])
}
