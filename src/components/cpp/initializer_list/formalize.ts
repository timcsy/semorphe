/** `cpp:initializer_list` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 大括號初值串列——巢狀的（`{{1,2},{3,4}}`）遞迴成 iL
  r.init('cpp:initializer_list', (n, f) => f.k('iL', { n: n.id, xs: (n.slots?.values ?? []).map((c) => f.initOf(c)) }))
}
