/** 這顆元件寫成 Python（447）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // std::max(a, b) → max(a, b)：相等、-0.0、NaN 時兩邊回傳的都是同一個（C++ 只在 b 嚴格較大時回 b，Python 只在後者嚴格較大時換）
  r.expr((n, py) => `max(${py.expr(n.slots.a?.[0])}, ${py.expr(n.slots.b?.[0])})`)
}
