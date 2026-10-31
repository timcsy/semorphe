/** `cpp:string_at` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_at', (n, f) => {
    const x = f.declOf(`${n.id}#obj`)
    if (!x) return f.miss(n, `字串名「${String(n.properties?.obj)}」指不到宣告（或不是單一名字）`)
    return f.k('eIndex', { n: n.id, a: f.k('eVar', { n: `${n.id}/obj`, x }), i: f.exprOf(n, 'index') })
  })
}
