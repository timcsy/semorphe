/** `cpp:input_line` 的 **formalize** 路（spec 199：6.0 量到學生的程式 8 支用 getline(cin, s)）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:input_line', (n, f) => f.k('eGetline', { n: n.id, target: f.exprOf(n, 'target') }))
  r.stmt('cpp:input_line', (n, f) => f.exprStmt(n))
}
