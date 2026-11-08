/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `i++;`／`i--;` 當敘述 → i += 1；當運算式（`a[i++]`）第一版不換
  r.stmt((n, py, depth) => {
    // char 的 ++（下一個字元）：Python 的字串不能加 1——保留（364）
    if (isChar(py.typeOf(n.slots.target?.[0]))) return [py.keep(n, 'char', 'char 的 ++／--')]
    return [`${py.indent(depth)}${py.expr(n.slots.target?.[0])} ${n.properties.operator === '--' ? '-=' : '+='} 1`]
  })
}
