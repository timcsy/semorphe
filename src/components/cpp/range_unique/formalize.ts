/** `cpp:range_unique` 的 **formalize** 路（spec 199：膠囊自證測換成 Cella 判準時補上）——`unique(b, e)` → `eCall "unique"`。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_unique', (n, f) => f.call(n, 'unique', ['begin', 'end']))
  r.stmt('cpp:range_unique', (n, f) => f.exprStmt(n))
}
