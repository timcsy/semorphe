/** `cpp:container_iter` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:container_iter', (n, f) => {
    const which = String(n.properties?.which ?? 'begin')
    return n.properties?.call === 'free'
      ? f.k('eCall', { n: n.id, f: which, args: [f.exprOf(n, 'obj')] })
      : f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: which, args: [] })
  })
}
