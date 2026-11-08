/** `cpp:literal_char` 寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { pyStr } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 字元字面量 → 長度 1 的字串（印出、比較都一樣；拿來算的在 arithmetic 那顆保留）
  r.expr('cpp:literal_char', (n) => pyStr(String(n.properties.char ?? '')))
}
