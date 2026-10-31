/** `cpp:if` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:if', (n, f) =>
    [f.k('sIf', { n: n.id, c: f.exprOf(n, 'condition'), t: f.block(n, 'then_body'), e: f.block(n, 'else_body') })])
}
