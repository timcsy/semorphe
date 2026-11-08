/** `cpp:literal_string` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { pyStr } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr('cpp:literal_string', (n) => pyStr(String(n.properties.value ?? '')))
}
