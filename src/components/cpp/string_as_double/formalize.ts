/** `cpp:string_as_double` 的 **formalize** 路（398）——`stod(s)`，同 string_as_int 送一般的函式呼叫。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_as_double', (n, f) => f.call(n, 'stod', ['value']))
}
