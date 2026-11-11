/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const op = String(n.properties.operator ?? '')
    const target = n.slots.target?.[0], value = n.slots.value?.[0]
    const i = cpp.indent(depth)
    // d[k] op= v（405）：先讀（缺鍵是 KeyError——經過 map_at）再寫回 d[k]。C++17 的 = 先算右邊，所以讀在插入之前
    const dictAt = target?.componentId.endsWith(':container_at') && cpp.pyKind(target.slots.target?.[0]) === 'dict'
    // 寫入的那一格沒有觀察到的型別——用字典的值型別
    const tt = dictAt ? /^dict\[.+, (.+)\]$/.exec(cpp.pyType(target!.slots.target?.[0]) ?? '')?.[1] : cpp.pyType(target), tv = cpp.pyType(value)
    const lhs = dictAt ? `${paren(target!.slots.target?.[0], cpp)}[${cpp.expr(target!.slots.key?.[0])}]` : cpp.expr(target)
    const apply = (bin: string) => (dictAt ? `${i}${lhs} = ${cpp.expr(target)} ${bin} ${cpp.expr(value)};` : `${i}${lhs} ${bin}= ${cpp.expr(value)};`)
    if ((op === '//=' || op === '%=') && tt === 'int' && tv === 'int') return [`${i}${lhs} = ${cpp.useHelper(op === '//=' ? 'floor_div' : 'floor_mod')}(${cpp.expr(target)}, ${cpp.expr(value)});`]
    if (op === '+=' && tt === 'str' && tv === 'str') return [apply('+')]
    const num = (t: string | undefined) => t === 'int' || t === 'float'
    if (['+=', '-=', '*='].includes(op) && num(tt) && num(tv)) return [apply(op.slice(0, -1))]
    return [cpp.keep(n, 'outside-subset', `${tt ?? '?'} ${op} ${tv ?? '?'} 還沒有對應`)]
  })
}
