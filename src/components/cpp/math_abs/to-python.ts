/** 這顆元件寫成 Python（455）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // abs(x) → abs(x)：整數回整數、浮點回浮點，兩邊一樣（abs(INT_MIN) 在 C++ 是未定義行為，Cella 那一側判）
  r.expr((n, py) => `abs(${py.expr(n.slots.value?.[0])})`)
}
