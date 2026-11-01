/** `cpp:range_max` 的 **formalize** 路（第 213 刀：`max_element(a, a + n)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_max', (n, f) => f.k('eCall', { n: n.id, f: 'max_element', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end')] }))
}
