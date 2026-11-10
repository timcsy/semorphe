/** `cpp:range_sum_partial` 的 **formalize** 路（399）——`partial_sum(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_sum_partial', (n, f) => f.k('eCall', { n: n.id, f: 'partial_sum', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end'), f.exprOf(n, 'dest')] }))
  r.stmt('cpp:range_sum_partial', (n, f) => f.exprStmt(n))
}
