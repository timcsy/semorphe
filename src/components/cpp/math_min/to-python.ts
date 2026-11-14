/** 這顆元件寫成 Python（447）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // std::min(a, b) → min(a, b)：相等、-0.0、NaN 時兩邊回傳的都是同一個（C++ 只在 b 嚴格較小時回 b，Python 只在後者嚴格較小時換）
  r.expr((n, py) => {
    const a = n.slots.a?.[0]
    // `std::min({a, b, c})`（456）：大括號串列（問形狀：沒有屬性、只有 values 槽）只填了 a——兩邊都回傳【第一個】最小的（C++ 的 min_element 與 Python 的 min() 都只在嚴格較小時換）
    if (a && a.slots?.values !== undefined && Object.keys(a.properties ?? {}).length === 0 && !n.slots.b?.length) {
      const xs = a.slots.values ?? []
      if (xs.length < 2) return py.keep(n, 'outside-subset', `min() 的大括號串列只有 ${xs.length} 個元素`)
      return `min(${xs.map((x) => py.expr(x)).join(', ')})`
    }
    return `min(${py.expr(a)}, ${py.expr(n.slots.b?.[0])})`
  })
}
