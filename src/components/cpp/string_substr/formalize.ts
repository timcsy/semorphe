/** `cpp:string_substr` 的 **formalize** 路（spec 202）——`s.substr(pos)`／`s.substr(pos, len)`，照 generate 送 eMCall（長度沒寫就不送）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_substr', (n, f) => f.k('eMCall', {
    n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'substr',
    args: [f.exprOf(n, 'pos'), ...(f.one(n, 'len') ? [f.exprOf(n, 'len')] : [])],
  }))
}
