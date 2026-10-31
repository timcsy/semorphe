/** `cpp:logic_not` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:logic_not', (n, f) => f.k('eUn', { n: n.id, op: f.k('opNot'), a: f.exprOf(n, 'operand') }))
}
