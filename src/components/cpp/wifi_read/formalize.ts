/** `cpp:wifi_read` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:wifi_read', (n, f) => f.k('eMCall', { n: n.id, obj: f.k('eConst', { n: `${n.id}/obj`, name: 'WiFi' }), arrow: false, f: n.properties?.quantity === 'address' ? 'localIP' : 'status', args: [] }))
}
