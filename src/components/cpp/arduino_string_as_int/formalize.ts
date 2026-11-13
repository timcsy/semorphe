/** `cpp:arduino_string_as_int` 的 **formalize** 路（435）——照 generate 送 eMCall（板子上 String 是 tClass，433）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:arduino_string_as_int', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'toInt', args: [] }))
}
