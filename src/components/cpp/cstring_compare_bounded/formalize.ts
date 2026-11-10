/** `cpp:cstring_compare_bounded` 的 **formalize** 路（399）——`strncmp(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cstring_compare_bounded', (n, f) => f.k('eCall', { n: n.id, f: 'strncmp', args: [f.exprOf(n, 's1'), f.exprOf(n, 's2'), f.exprOf(n, 'n')] }))
}
