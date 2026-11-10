/** `cpp:program_exit` 的 **formalize** 路（399）——`exit(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:program_exit', (n, f) => f.k('eCall', { n: n.id, f: 'exit', args: [f.exprOf(n, 'code')] }))
  r.stmt('cpp:program_exit', (n, f) => f.exprStmt(n))
}
