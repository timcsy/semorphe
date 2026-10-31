/** `cpp:builtin_constant` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:builtin_constant', (n, f) => {
    const v = String(n.properties?.value ?? '')
    if (v === 'true' || v === 'false') return f.k('eBool', { n: n.id, b: v === 'true' })
    return f.k('eConst', { n: n.id, name: v })
  })
}
