/**
 * 這顆元件寫成 Python（475）：std::deque<純量> → collections.deque——兩端進出、[i]、len、clear、走訪都同名同義。
 * 空的、給個數（每格是零值）、給個數與初值、大括號列出、複製另一個（`deque<int> b = a;` C++ 複製一份 ⟹ `collections.deque(a)`）；
 * 範圍建構（兩個位置）第一版不換。放進去的值照元素型別換（整數截斷、bool 包 bool(…)，同 vector）。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, elementValue, zeroOf, paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const t = String(n.properties.type ?? '')
    if (adapterKind(`deque<${t}>`) !== 'deque') return [py.keep(n, 'outside-subset', `deque<${t}> 還沒有對應`)]
    const lhs = `${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${py.useImport('collections')}.deque`
    const s = n.slots
    if (s.source_end?.length) return [py.keep(n, 'outside-subset', `用一段範圍建構 deque<${t}> 還沒有對應`)]
    if (s.source?.length) return [`${lhs}(${py.expr(s.source[0])})`]
    if (s.values?.length) {
      const vs = s.values.map((v) => elementValue(t, v, py))
      if (vs.some((v) => v === undefined)) return [py.keep(n, 'needs-types', `放進 deque<${t}> 的值要照元素型別換，而換不了`)]
      return [`${lhs}([${vs.join(', ')}])`]
    }
    if (s.size?.length) {
      const fill = s.fill?.length ? elementValue(t, s.fill[0], py) : zeroOf(t)
      if (fill === undefined) return [py.keep(n, 'needs-types', `deque<${t}> 每一格的初值換不了`)]
      return [`${lhs}([${fill}] * ${paren(s.size[0], py)})`]
    }
    return [`${lhs}()`]
  })
}
