/** `cpp:string_find_last_not_of` 的 **formalize** 路（spec 199）——`s.find_last_not_of(x)`，照 generate 送 eMCall。找不到時回 `string::npos`（不是 -1）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_find_last_not_of', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'find_last_not_of', args: [f.exprOf(n, 'arg')] }))
}
