/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar, ToCppContext } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => extreme(n, cpp, 'max'))
}
/** max／min：一個清單 → *max_element；兩個以上的值且同型別 → max({…}) */
export function extreme(n: SemanticNode, cpp: ToCppContext, f: 'max' | 'min'): string {
  const vs = n.slots.values ?? []
  if (vs.length === 1) {
    const t = cpp.pyType(vs[0])
    if (!t || !/^list\[(int|float)\]$/.test(t)) return cpp.keep(n, 'type-uncertain', `${f} 的對象型別（${t ?? '?'}）`)
    cpp.useInclude('algorithm')
    return `*${f}_element(${cpp.expr(vs[0])}.begin(), ${cpp.expr(vs[0])}.end())`
  }
  const ts = new Set(vs.map((v) => cpp.pyType(v)))
  if (ts.size !== 1 || !['int', 'float'].includes([...ts][0] ?? '')) return cpp.keep(n, 'type-uncertain', `${f} 的參數型別不一致`)
  cpp.useInclude('algorithm')
  return `${f}({${vs.map((v) => cpp.expr(v)).join(', ')}})`
}
