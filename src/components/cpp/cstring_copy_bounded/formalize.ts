/** `cpp:cstring_copy_bounded` 的 **formalize** 路（399）——`strncpy(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cstring_copy_bounded', (n, f) => f.k('eCall', { n: n.id, f: 'strncpy', args: [f.exprOf(n, 'dest'), f.exprOf(n, 'src'), f.exprOf(n, 'n')] }))
  r.stmt('cpp:cstring_copy_bounded', (n, f) => f.exprStmt(n))
}
