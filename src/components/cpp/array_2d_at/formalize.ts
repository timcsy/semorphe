/** `cpp:array_2d_at` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:array_2d_at', (n, f) =>
    f.k('eIndex', { n: n.id, a: f.k('eIndex', { n: `${n.id}/row`, a: f.exprOf(n, 'obj'), i: f.exprOf(n, 'row') }), i: f.exprOf(n, 'col') }))
}
