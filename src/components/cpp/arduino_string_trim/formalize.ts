/** `cpp:arduino_string_trim` 的 **formalize** 路（435）——`s.trim()`，照 generate 送 eMCall（板子上 String 是 tClass，433）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:arduino_string_trim', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'trim', args: [] }))
  r.stmt('cpp:arduino_string_trim', (n, f) => f.exprStmt(n))
}
