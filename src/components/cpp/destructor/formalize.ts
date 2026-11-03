/** `cpp:destructor` 的 **formalize** 路（spec 203）——類別成員 `mbDtor virt n body`（形狀照 Cella 的 `cfamily.syntax`）。virtual 由 `is_virtual` 照實送（spec 209）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:destructor', (n, f) => f.k('mbDtor', { virt: String(n.properties?.is_virtual ?? 'false') === 'true', n: n.id, body: f.block(n, 'body') }))
}
