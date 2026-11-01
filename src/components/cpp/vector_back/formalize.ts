/** `cpp:vector_back` 的 **formalize** 路（spec 199：6.0 量到學生的程式 14 支用 back()）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:vector_back', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'back', args: [] }))
}
