/** `cpp:var_swap` 的 **formalize** 路（spec 199：6.0 量到學生的程式 9 支用 swap）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:var_swap', (n, f) => f.k('eCall', { n: n.id, f: 'swap', args: [f.exprOf(n, 'left'), f.exprOf(n, 'right')] }))
  r.stmt('cpp:var_swap', (n, f) => f.exprStmt(n))
}
