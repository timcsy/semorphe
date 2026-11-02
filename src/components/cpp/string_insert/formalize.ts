/** `cpp:string_insert` 的 **formalize** 路（spec 203）——`s.insert(pos, str)` → `eMCall "insert"`。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_insert', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'insert', args: [f.exprOf(n, 'pos'), f.exprOf(n, 'value')] }))
  r.stmt('cpp:string_insert', (n, f) => f.exprStmt(n))
}
