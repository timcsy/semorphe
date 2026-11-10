/** `cpp:string_append` 的 **formalize** 路（398）——`s.append(t)`，照 generate 送 eMCall。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_append', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'append', args: [f.exprOf(n, 'value')] }))
  r.stmt('cpp:string_append', (n, f) => f.exprStmt(n))
}
