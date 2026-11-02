/** `cpp:char_to_upper` 的 **formalize** 路（spec 203）——`toupper(x)`，送 eCall（同 char_is_alpha）。⚠️ 回傳 int——印成字元要轉型。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:char_to_upper', (n, f) => f.k('eCall', { n: n.id, f: 'toupper', args: [f.exprOf(n, 'value')] }))
}
