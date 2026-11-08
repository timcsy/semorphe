/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const i = cpp.indent(depth)
    const v = cpp.name(String(n.properties.obj ?? ''))
    if ((n.slots.targets ?? []).length > 0) return [cpp.keep(n, 'outside-subset', 'for 拆開多個變數還沒有對應')]
    const it = n.slots.iterable?.[0]
    if (it?.componentId.endsWith(':range_make')) {
      // for i in range(a, b, s)：迴圈變數已由引擎提前宣告（Python 的迴圈變數在迴圈之後還在）
      const vs = it.slots.values ?? []
      if (vs.length === 0 || vs.length > 3) return [cpp.keep(n, 'outside-subset', 'range 的參數個數')]
      const [a, b] = vs.length === 1 ? ['0', cpp.expr(vs[0])] : [cpp.expr(vs[0]), cpp.expr(vs[1])]
      let step = '1', down = false
      if (vs.length === 3) {
        const s = vs[2]
        const lit = (x: typeof s) => x?.componentId.endsWith(':literal_number') ? String(x.properties?.value) : undefined
        const neg = s.componentId.endsWith(':negate') ? lit(s.slots?.value?.[0]) : undefined
        if (neg) { step = neg; down = true } else if (lit(s)) { step = lit(s)! } else { return [cpp.keep(n, 'outside-subset', 'range 的步長不是字面量（看不出往上還是往下）')] }
      }
      // 迴圈之後讀它、或本體改它 → 用一個看不見的計數器帶迭代，每一圈把值給它（Python：結束時是最後一個值、改它不影響下一圈）
      const plain = cpp.plainLoopVar(n, String(n.properties.obj ?? ''))
      const c = plain ? v : `${v}__`
      const inc = step === '1' ? (down ? `${c}--` : `${c}++`) : `${c} ${down ? '-' : '+'}= ${step}`
      const head = plain ? `${i}for (${c} = ${a}; ${c} ${down ? '>' : '<'} ${b}; ${inc}) {` : `${i}for (long long ${c} = ${a}; ${c} ${down ? '>' : '<'} ${b}; ${inc}) {`
      return [head, ...(plain ? [] : [`${cpp.indent(depth + 1)}${v} = ${c};`]), ...cpp.block(n.slots.body, depth + 1), `${i}}`]
    }
    // for x in xs：元素型別從容器觀察到的型別來
    const t = cpp.pyType(it)
    const m = t ? /^list\[(.+)\]$/.exec(t) : null
    const et = m ? cpp.cppType(m[1]) : t === 'str' ? 'char' : undefined
    if (!et || t === 'str') return [cpp.keep(n, 'type-uncertain', `for 走訪的對象型別（${t ?? '?'}）`)]
    return [`${i}for (${et} ${v} : ${cpp.expr(it)}) {`, ...cpp.block(n.slots.body, depth + 1), `${i}}`]
  })
}
