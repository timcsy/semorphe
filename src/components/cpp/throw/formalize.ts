/** `cpp:throw` 的 **formalize** 路（spec 203）——`throw e;` → `sThrow n (some e)`；`throw;`（重拋）→ `sThrow n none`。形狀照 Cella 的 `cfamily.syntax`。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:throw', (n, f) => [f.k('sThrow', { n: n.id, e: f.one(n, 'value') ? f.exprOf(n, 'value') : null })])
}
