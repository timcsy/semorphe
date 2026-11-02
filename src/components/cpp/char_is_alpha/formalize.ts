/** `cpp:char_is_alpha` 的 **formalize** 路（spec 199）——`isalpha(x)`，照 generate 送 eCall。⚠️ C++ 只保證回非零（glibc 印 1024），斷言要寫 `!= 0`。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:char_is_alpha', (n, f) => f.k('eCall', { n: n.id, f: 'isalpha', args: [f.exprOf(n, 'value')] }))
}
