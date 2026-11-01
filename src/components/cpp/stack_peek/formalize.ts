/** `cpp:stack_peek` 的 **formalize** 路（第 213 刀）——`s.top()` → `eMCall … "top"`，同 `queue_front`。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:stack_peek', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'top', args: [] }))
}
