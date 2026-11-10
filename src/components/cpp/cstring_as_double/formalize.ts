/** `cpp:cstring_as_double` 的 **formalize** 路（399）——`atof(…)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cstring_as_double', (n, f) => f.k('eCall', { n: n.id, f: 'atof', args: [f.exprOf(n, 'str')] }))
}
