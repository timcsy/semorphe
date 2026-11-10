/** `cpp:math_lcm` 的 **formalize** 路（398）——`lcm(a, b)`（C++17 <numeric>），照 generate 送一般的函式呼叫。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:math_lcm', (n, f) => f.call(n, 'lcm', ['a', 'b']))
}
