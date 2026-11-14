/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.conditional()
  r.yieldsBool()
  r.expr((n, py) => {
    const op = n.properties.operator === '||' ? 'or' : n.properties.operator === '&&' ? 'and' : null
    if (!op) return py.keep(n, 'outside-subset', `運算子 ${String(n.properties.operator)} 還沒有對應`)
    return `${paren(n.slots.left?.[0], py)} ${op} ${paren(n.slots.right?.[0], py)}`
  })
}
