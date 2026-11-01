/** `cpp:char_is_digit` 的 **formalize** 路（spec 199：6.0 量到學生的程式 3 支用 isdigit）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:char_is_digit', (n, f) => f.k('eCall', { n: n.id, f: 'isdigit', args: [f.exprOf(n, 'value')] }))
}
