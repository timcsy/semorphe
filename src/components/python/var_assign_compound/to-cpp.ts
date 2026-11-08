/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const op = String(n.properties.operator ?? '')
    const target = n.slots.target?.[0], value = n.slots.value?.[0]
    const tt = cpp.pyType(target), tv = cpp.pyType(value)
    const i = cpp.indent(depth)
    if ((op === '//=' || op === '%=') && tt === 'int' && tv === 'int') return [`${i}${cpp.expr(target)} = ${cpp.useHelper(op === '//=' ? 'floor_div' : 'floor_mod')}(${cpp.expr(target)}, ${cpp.expr(value)});`]
    if (op === '+=' && tt === 'str' && tv === 'str') return [`${i}${cpp.expr(target)} += ${cpp.expr(value)};`]
    const num = (t: string | undefined) => t === 'int' || t === 'float'
    if (['+=', '-=', '*='].includes(op) && num(tt) && num(tv)) return [`${i}${cpp.expr(target)} ${op} ${cpp.expr(value)};`]
    return [cpp.keep(n, 'outside-subset', `${tt ?? '?'} ${op} ${tv ?? '?'} 還沒有對應`)]
  })
}
