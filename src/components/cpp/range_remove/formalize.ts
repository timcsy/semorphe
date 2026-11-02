/** `cpp:range_remove` 的 **formalize** 路（spec 199：膠囊自證測換成 Cella 判準時補上）——`remove(b, e, x)` → `eCall "remove"`。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_remove', (n, f) => f.call(n, 'remove', ['begin', 'end', 'value']))
  r.stmt('cpp:range_remove', (n, f) => f.exprStmt(n))
}
