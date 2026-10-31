/** `cpp:literal_char` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:literal_char', (n, f) => {
    const c = f.unescapeC(String(n.properties?.char ?? ''))
    return c.length === 1 ? f.k('eChar', { n: n.id, c: c.charCodeAt(0) }) : f.miss(n, '字元字面不是單一字元')
  })
}
