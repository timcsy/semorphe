/** `cpp:math_is_nan` 的 **formalize** 路：`<cmath>` 的 `isnan`（spec 203；cella cpp 的 `fisnan`、c 的 `isnan`，依名字解析）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:math_is_nan', (n, f) => f.k('eCall', { n: n.id, f: 'isnan', args: [f.exprOf(n, 'value')] }))
}
