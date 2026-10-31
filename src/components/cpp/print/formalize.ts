/** `cpp:print` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:print', (n, f) =>
    [f.k('sCout', { n: n.id, items: (n.slots?.values ?? []).map((c) => f.expr(c)) })])
}
