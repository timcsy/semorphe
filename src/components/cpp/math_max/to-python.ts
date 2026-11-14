/** 這顆元件寫成 Python（447）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // std::max(a, b) → max(a, b)：相等、-0.0、NaN 時兩邊回傳的都是同一個（C++ 只在 b 嚴格較大時回 b，Python 只在後者嚴格較大時換）
  r.expr((n, py) => {
    const a = n.slots.a?.[0]
    // `std::max({a, b, c})`（456）：大括號串列（問形狀：沒有屬性、只有 values 槽）只填了 a——兩邊都回傳【第一個】最大的（C++ 的 max_element 與 Python 的 max() 都只在嚴格較大時換）
    if (a && a.slots?.values !== undefined && Object.keys(a.properties ?? {}).length === 0 && !n.slots.b?.length) {
      const xs = a.slots.values ?? []
      if (xs.length < 2) return py.keep(n, 'outside-subset', `max() 的大括號串列只有 ${xs.length} 個元素`)
      return `max(${xs.map((x) => py.expr(x)).join(', ')})`
    }
    return `max(${py.expr(a)}, ${py.expr(n.slots.b?.[0])})`
  })
}
