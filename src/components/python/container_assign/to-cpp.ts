/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import { paren } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const target = n.slots.target?.[0]
    // d[k] = v（405）：Python 沒有就新增、有就蓋掉——與 C++ map 的 [] 指定相同（讀取才要經過 map_at）
    if (target?.componentId.endsWith(':container_at') && cpp.pyKind(target.slots.target?.[0]) === 'dict') {
      const obj = target.slots.target?.[0]
      const key = target.slots.key?.[0]
      const line = `${cpp.indent(depth)}${paren(obj, cpp)}[${cpp.expr(key)}] = ${cpp.expr(n.slots.value?.[0])};`
      // 照放入的順序走訪的字典（441）：新的鍵接在那一串鍵後面——鍵會算兩次，所以只收名字與字面量
      const keys = obj?.componentId.endsWith(':var_ref') ? cpp.dictKeys(String(obj.properties?.name ?? '')) : undefined
      if (!keys) return [line]
      if (!key || !/:(var_ref|literal_string|literal_number)$/.test(key.componentId)) {
        return [cpp.keep(n, 'outside-subset', '照放入的順序走訪的字典：寫入的鍵要是名字或字面量（要先問有沒有這個鍵）')]
      }
      const i = cpp.indent(depth), d = cpp.expr(obj), k = cpp.expr(key)
      return [`${i}if (${d}.count(${k}) == 0) {`, `${cpp.indent(depth + 1)}${cpp.name(keys)}.push_back(${k});`, `${i}}`, line]
    }
    return [`${cpp.indent(depth)}${cpp.expr(target)} = ${cpp.expr(n.slots.value?.[0])};`]
  })
}
