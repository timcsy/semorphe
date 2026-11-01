/** `cpp:math_abs` 的 **formalize** 路（spec 199：6.0 量到學生的程式 6 支用 abs）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:math_abs', (n, f) => f.k('eCall', { n: n.id, f: 'abs', args: [f.exprOf(n, 'value')] }))
}
