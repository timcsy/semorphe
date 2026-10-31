/** `cpp:pin_constant` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 板子的常數（HIGH、OUTPUT、LED_BUILTIN…）：`{"k": "eConst", "name": …}`
  r.expr('cpp:pin_constant', (n, f) => f.k('eConst', { n: n.id, name: String(n.properties?.value ?? '') }))
}
