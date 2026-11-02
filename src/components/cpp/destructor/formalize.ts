/** `cpp:destructor` 的 **formalize** 路（spec 203）——類別成員 `mbDtor virt n body`（形狀照 Cella 的 `cfamily.syntax`）。`virtual ~A()` 語義樹沒有記，照實送 false。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:destructor', (n, f) => f.k('mbDtor', { virt: false, n: n.id, body: f.block(n, 'body') }))
}
