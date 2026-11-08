/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `i++;`／`i--;` 當敘述 → i += 1；當運算式（`a[i++]`）第一版不換
  r.stmt((n, py, depth) => [`${py.indent(depth)}${py.expr(n.slots.target?.[0])} ${n.properties.operator === '--' ? '-=' : '+='} 1`])
}
