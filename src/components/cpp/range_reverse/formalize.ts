/** `cpp:range_reverse` 的 **formalize** 路（第 207 刀：`reverse(a, a + n)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_reverse', (n, f) => f.k('eCall', { n: n.id, f: 'reverse', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end')] }))
  r.stmt('cpp:range_reverse', (n, f) => f.exprStmt(n))
}
