/** `cpp:struct_at_ptr` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:struct_at_ptr', (n, f) => f.k('eArrow', { n: n.id, a: f.exprOf(n, 'obj'), f: f.identMacro(String(n.properties?.member ?? '')) }))
}
