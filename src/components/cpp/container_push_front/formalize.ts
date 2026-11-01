/** `cpp:container_push_front` 的 **formalize** 路（第 207 刀：deque 的 push_front）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:container_push_front', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'push_front', args: (n.slots?.value ?? []).map((c) => f.expr(c)) }))
  r.stmt('cpp:container_push_front', (n, f) => f.exprStmt(n))
}
