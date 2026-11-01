/** `cpp:container_pop_front` 的 **formalize** 路（spec 199：6.0 量到學生的程式 21 支用 pop_front）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:container_pop_front', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'pop_front', args: [] }))
  r.stmt('cpp:container_pop_front', (n, f) => f.exprStmt(n))
}
