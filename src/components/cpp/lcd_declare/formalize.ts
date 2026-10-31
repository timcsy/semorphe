/** `cpp:lcd_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:lcd_declare', (n, f, global) => f.libraryObject(n, String(n.properties?.decl_type ?? 'LiquidCrystal'), global))
}
