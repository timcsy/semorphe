/** `cpp:arduino_string_find` 的 **formalize** 路（435）——照 generate 送 eMCall（板子上 String 是 tClass，433）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:arduino_string_find', (n, f) => f.k('eMCall', {
    n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: 'indexOf',
    args: (['arg', 'from'] as string[]).filter((sl) => (n.slots[sl] ?? []).length > 0).map((sl) => f.exprOf(n, sl)),
  }))
}
