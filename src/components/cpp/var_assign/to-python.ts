/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const target = n.slots.target?.[0]
    if ((py.typeOf(target) ?? '').includes('char')) return [py.keep(n, 'char', '改一個字元：C++ 的字串可以改、Python 的字串不能')]
    return [`${py.indent(depth)}${py.expr(target)} = ${py.expr(n.slots.value?.[0])}`]
  })
}
