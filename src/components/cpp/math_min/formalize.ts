/** `cpp:math_min` 的 **formalize** 路（spec 199：6.0 量到學生的程式 15 支用 min）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:math_min', (n, f) => f.k('eCall', { n: n.id, f: 'min', args: [f.exprOf(n, 'a'), f.exprOf(n, 'b')] }))
}
