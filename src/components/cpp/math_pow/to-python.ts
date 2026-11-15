/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { atom, isSignedInt, isUnsignedInt } from '../../../languages/cpp/to-python/contract'

/**
 * `**` 比一元負號、三元、比較都綁得緊（`-2 ** 2` 是 -4，448 之前 `pow(-2, 2)` 換出來就是這個——C++ 印 4、Python 印 -4）
 * ⟹ 兩邊不是原子時加括號（`atom`）
 */

export function registerToPython(r: ToPythonRegistrar): void {
  // pow(a, b) → a ** b（印法照型別：C++ 的 pow 是 double ⟹ format(…, "g")，整數的 ** 也印得一樣）
  r.expr((n, py) => {
    const isInt = (x: typeof n | undefined): boolean => isSignedInt(py.typeOf(x)) || isUnsignedInt(py.typeOf(x))
    // 兩邊都是整數（480）：C++ 的 pow 算成 double（超過 2^53 會捨入），Python 的整數 ** 是精確整數——`(long long)pow(3, 39)` 末幾位不同 ⟹ 照實保留
    if (isInt(n.slots.base?.[0]) && isInt(n.slots.exponent?.[0])) return py.keep(n, 'overflow', 'pow 的兩邊都是整數：C++ 算成 double（超過 2^53 會捨入），Python 的 ** 是精確整數')
    return `${atom(py.expr(n.slots.base?.[0]))} ** ${atom(py.expr(n.slots.exponent?.[0]))}`
  })
}
