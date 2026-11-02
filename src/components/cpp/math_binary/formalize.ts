/** `cpp:math_binary` 的 **formalize** 路（spec 199，6c-2a 遷移膠囊自證測時量到它沒有）——`fmod(a, b)` 等兩個引數的數學函式，照 generate 送 eCall。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:math_binary', (n, f) => f.k('eCall', { n: n.id, f: String(n.properties?.func ?? 'fmod'), args: [f.exprOf(n, 'arg1'), f.exprOf(n, 'arg2')] }))
}
