/** `cpp:queue_back` 的 **formalize** 路（399）——`q.back()`，照 generate 送 eMCall。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:queue_back', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'back', args: [] }))
}
