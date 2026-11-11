/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const target = n.slots.target?.[0]
    // d[k] = v（405）：Python 沒有就新增、有就蓋掉——與 C++ map 的 [] 指定相同（讀取才要經過 map_at）
    if (target?.componentId.endsWith(':container_at') && cpp.pyKind(target.slots.target?.[0]) === 'dict') {
      const obj = target.slots.target?.[0]
      return [`${cpp.indent(depth)}${paren(obj, cpp)}[${cpp.expr(target.slots.key?.[0])}] = ${cpp.expr(n.slots.value?.[0])};`]
    }
    return [`${cpp.indent(depth)}${cpp.expr(target)} = ${cpp.expr(n.slots.value?.[0])};`]
  })
}
