/** `cpp:string_as_int` 的 **formalize** 路（spec 202）——`stoi(s)`，照 generate 送一般的函式呼叫。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:string_as_int', (n, f) => f.call(n, 'stoi', ['value']))
}
