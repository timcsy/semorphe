/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const i = cpp.indent(depth)
    // 迴圈的 `else:`（沒遇到 break 才做）在 C++ 沒有一對一的寫法——照實留著，不猜（第 417 刀）
    if ((n.slots.else_body ?? []).length > 0) return [cpp.keep(n, 'outside-subset', '迴圈的 else（沒被 break 才做）還沒有對應')]
    // 名字以 `targets` 為準（積木抽回來的樹只有它），沒有時才讀 `obj`
    const loopName = String(n.slots.targets?.[0]?.properties.name ?? n.properties.obj ?? '')
    const v = cpp.name(loopName)
    // 第 411 刀起單一名字也在 `targets` 裡——多於一個才是「拆開多個變數」
    if ((n.slots.targets ?? []).length > 1) return [cpp.keep(n, 'outside-subset', 'for 拆開多個變數還沒有對應')]
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
      const plain = cpp.plainLoopVar(n, loopName)
      const c = plain ? v : `${v}__`
      const inc = step === '1' ? (down ? `${c}--` : `${c}++`) : `${c} ${down ? '-' : '+'}= ${step}`
      const head = plain ? `${i}for (${c} = ${a}; ${c} ${down ? '>' : '<'} ${b}; ${inc}) {` : `${i}for (long long ${c} = ${a}; ${c} ${down ? '>' : '<'} ${b}; ${inc}) {`
      return [head, ...(plain ? [] : [`${cpp.indent(depth + 1)}${v} = ${c};`]), ...cpp.block(n.slots.body, depth + 1), `${i}}`]
    }
    // for k in sorted(d)（405）：C++ 的 map 照鍵排序走訪——與 sorted(字典) 同一個順序。本體改那個字典就不換（sorted 先拷了一份鍵）
    if (it?.componentId.endsWith(':container_sort') && !(it.slots.key ?? []).length && !(it.slots.reverse ?? []).length) {
      const d = it.slots.obj?.[0], dt = cpp.pyType(d)
      if (d?.componentId.endsWith(':var_ref') && /^dict\[/.test(dt ?? '')) {
        const dn = String(d.properties?.name ?? '')
        if (changesDict(n.slots.body ?? [], dn)) return [cpp.keep(n, 'outside-subset', `走訪 sorted(${dn}) 時本體改了 ${dn}`)]
        const mt = cpp.cppType(dt), kt = cpp.cppType(/^dict\[(.+?), /.exec(dt!)?.[1])
        if (!mt || !kt) return [cpp.keep(n, 'type-uncertain', `字典的型別（${dt}）`)]
        return [`${i}for (auto ${v}__ : ${cpp.expr(d)}) {`, `${cpp.indent(depth + 1)}${kt} ${v} = ${v}__.first;`, ...cpp.block(n.slots.body, depth + 1), `${i}}`]
      }
    }
    // for x in xs：元素型別從容器觀察到的型別來
    const t = cpp.pyType(it)
    // for k in d：Python 照插入順序、C++ 的 map 照鍵排序——順序不同
    if (t && /^dict\[/.test(t)) return [cpp.keep(n, 'outside-subset', '直接走訪字典（Python 照放入的順序，C++ 的 map 照鍵排序）')]
    const m = t ? /^list\[(.+)\]$/.exec(t) : null
    const et = m ? cpp.cppType(m[1]) : t === 'str' ? 'char' : undefined
    if (!et || t === 'str') return [cpp.keep(n, 'type-uncertain', `for 走訪的對象型別（${t ?? '?'}）`)]
    return [`${i}for (${et} ${v} : ${cpp.expr(it)}) {`, ...cpp.block(n.slots.body, depth + 1), `${i}}`]
  })
}

/** 本體裡有沒有改到名為 name 的字典：讀（d[k]、d.get、len(d)）以外的出現都算 */
function changesDict(body: readonly SemanticNode[], name: string): boolean {
  let changed = false
  const walk = (n: SemanticNode, parent: SemanticNode | undefined, slot: string): void => {
    if (n.componentId.endsWith(':var_ref') && n.properties?.name === name) {
      const p = parent?.componentId ?? ''
      const readAt = p.endsWith(':container_at') && slot === 'target'
      const read = (p.endsWith(':map_at_default') && slot === 'obj') || (p.endsWith(':container_size') && slot === 'obj') || p.endsWith(':print')
      if (!read && !readAt) changed = true
    }
    // d[k] = …／d[k] += …：寫入的那一格
    if ((n.componentId.endsWith(':container_assign') || n.componentId.endsWith(':var_assign_compound')) && n.slots?.target?.[0]?.slots?.target?.[0]?.properties?.name === name) changed = true
    if (n.properties?.obj === name && n.slots?.value) changed = true
    for (const [k, cs] of Object.entries(n.slots ?? {})) for (const c of cs) walk(c, n, k)
  }
  body.forEach((b) => walk(b, undefined, ''))
  return changed
}
