/** `cpp:string_clear` 的 **formalize** 路（398）——`s.clear()`，照 generate 送 eMCall。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_clear', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'clear', args: [] }))
  r.stmt('cpp:string_clear', (n, f) => f.exprStmt(n))
}
