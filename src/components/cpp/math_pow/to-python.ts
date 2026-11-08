/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // pow(a, b) → a ** b（印法照型別：C++ 的 pow 是 double ⟹ format(…, "g")，整數的 ** 也印得一樣）
  r.expr((n, py) => `${paren(n.slots.base?.[0], py)} ** ${paren(n.slots.exponent?.[0], py)}`)
}
