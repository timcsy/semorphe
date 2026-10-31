/** `cpp:pointer_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:pointer_declare', (n, f, global) => {
    const base = f.type(n.properties?.type, n)
    if (!base) return []
    return f.declVar(n, f.k('tPtr', { t: base }), global)
  })
}
