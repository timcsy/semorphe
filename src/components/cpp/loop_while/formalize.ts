/** `cpp:loop_while` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:loop_while', (n, f) =>
    [f.k('sWhile', { n: n.id, c: f.exprOf(n, 'condition'), body: f.block(n, 'body') })])
}
