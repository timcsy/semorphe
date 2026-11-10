/** `cpp:range_fill_sequence` 的 **formalize** 路（399）——`iota(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_fill_sequence', (n, f) => f.k('eCall', { n: n.id, f: 'iota', args: [f.exprOf(n, 'begin'), f.exprOf(n, 'end'), f.exprOf(n, 'value')] }))
  r.stmt('cpp:range_fill_sequence', (n, f) => f.exprStmt(n))
}
