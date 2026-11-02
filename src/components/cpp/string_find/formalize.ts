/** `cpp:string_find` 的 **formalize** 路（spec 202）——`s.find(x)`／`s.find(x, pos)`，照 generate 送 eMCall（起點沒寫就不送）。找不到時回 `string::npos`（不是 -1）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_find', (n, f) => f.k('eMCall', {
    n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'find',
    args: [f.exprOf(n, 'arg'), ...(f.one(n, 'from') ? [f.exprOf(n, 'from')] : [])],
  }))
}
