/** 這顆元件寫成 C++（407）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // [運算式 for x in xs if 條件] → 在這一句前面先建一個 vector，逐一 push_back（C++ 沒有串列生成式）。
  // 只收：單層、list 或 range（一到兩個引數）、整句只算一次而其餘部分沒有副作用（canHoist）
  r.expr((n, cpp) => {
    if (String(n.properties.wrap ?? '') !== '') return cpp.keep(n, 'outside-subset', '產生器運算式與集合生成式還沒有對應')
    if ((n.slots.outer ?? []).length) return cpp.keep(n, 'outside-subset', '兩層的生成式還沒有對應')
    if ((n.slots.targets ?? []).length > 1) return cpp.keep(n, 'outside-subset', '生成式拆開多個變數還沒有對應')
    if (!cpp.canHoist(n)) return cpp.keep(n, 'outside-subset', '生成式在條件、短路或有副作用的敘述裡（先算好會改變求值的次數或先後）')
    const et = cpp.cppType(/^list\[(.+)\]$/.exec(cpp.pyType(n) ?? '')?.[1])
    if (!et) return cpp.keep(n, 'type-uncertain', `生成式結果的型別（${cpp.pyType(n) ?? '?'}）`)
    // 名字以 `targets` 為準（積木抽回來的樹只有它），沒有時才讀 `obj`
    const v = cpp.name(String(n.slots.targets?.[0]?.properties.name ?? n.properties.obj ?? 'x'))
    const it = n.slots.iterable?.[0]
    let head: string
    if (it?.componentId.endsWith(':range_make')) {
      const vs = it.slots.values ?? []
      if (vs.length < 1 || vs.length > 2) return cpp.keep(n, 'outside-subset', '生成式的 range 參數個數')
      const [a, b] = vs.length === 1 ? ['0', cpp.expr(vs[0])] : [cpp.expr(vs[0]), cpp.expr(vs[1])]
      head = `for (long long ${v} = ${a}; ${v} < ${b}; ${v}++) {`
    } else {
      const ie = cpp.cppType(/^list\[(.+)\]$/.exec(cpp.pyType(it) ?? '')?.[1])
      if (!ie) return cpp.keep(n, 'type-uncertain', `生成式走訪的對象型別（${cpp.pyType(it) ?? '?'}）`)
      head = `for (${ie} ${v} : ${cpp.expr(it)}) {`
    }
    const e = cpp.expr(n.slots.expression?.[0])
    const c = n.slots.condition?.[0]
    const cond = c ? cpp.expr(c) : undefined
    cpp.useInclude('vector')
    return cpp.hoist(n, 'items', (name) => [
      `vector<${et}> ${name};`,
      head,
      ...(cond ? [`    if (${cond}) {`, `        ${name}.push_back(${e});`, '    }'] : [`    ${name}.push_back(${e});`]),
      '}',
    ])
  })
}
