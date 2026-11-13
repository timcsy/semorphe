/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { atom } from '../../../languages/cpp/to-python/contract'

/**
 * `**` 比一元負號、三元、比較都綁得緊（`-2 ** 2` 是 -4，448 之前 `pow(-2, 2)` 換出來就是這個——C++ 印 4、Python 印 -4）
 * ⟹ 兩邊不是原子時加括號（`atom`）
 */

export function registerToPython(r: ToPythonRegistrar): void {
  // pow(a, b) → a ** b（印法照型別：C++ 的 pow 是 double ⟹ format(…, "g")，整數的 ** 也印得一樣）
  r.expr((n, py) => `${atom(py.expr(n.slots.base?.[0]))} ** ${atom(py.expr(n.slots.exponent?.[0]))}`)
}
