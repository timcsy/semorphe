/** `cpp:range_find` 的 **formalize** 路（第 207 刀：`find(a, a + n, x)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_find', (n, f) => f.k('eCall', { n: n.id, f: 'std::find', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end'), f.exprOf(n, 'value')] }))
}
