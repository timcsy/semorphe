/** `cpp:pin_constant_level` 的 **formalize** 路——板子的具名常數：`{"k": "eConst", "name": …}`（與 pin_constant 同一個建構子）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:pin_constant_level', (n, f) => f.k('eConst', { n: n.id, name: String(n.properties?.value ?? '') }))
}
