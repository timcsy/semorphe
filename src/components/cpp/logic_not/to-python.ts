/** `cpp:logic_not` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.yieldsBool('cpp:logic_not')
  r.expr('cpp:logic_not', (n, py) => `not ${paren(n.slots.operand?.[0], py)}`)
}
