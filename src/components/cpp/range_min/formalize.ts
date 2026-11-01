/** `cpp:range_min` 的 **formalize** 路（第 213 刀：`min_element(a, a + n)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_min', (n, f) => f.k('eCall', { n: n.id, f: 'min_element', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end')] }))
}
