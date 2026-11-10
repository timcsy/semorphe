/** `cpp:cstring_find` 的 **formalize** 路（399）——`strstr(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cstring_find', (n, f) => f.k('eCall', { n: n.id, f: 'strstr', args: [f.exprOf(n, 'haystack'), f.exprOf(n, 'needle')] }))
}
