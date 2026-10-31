/** `cpp:return` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:return', (n, f) => {
    const v = f.one(n, 'value')
    return [f.k('sReturn', { n: n.id, e: v ? f.expr(v) : null })]
  })
}
