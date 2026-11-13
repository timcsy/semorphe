/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'

export function registerToCpp(r: ToCppRegistrar): void {
  // 宣告已由引擎提到函式最前面（research R2）——這裡只是指定
  r.stmt((n, cpp, depth) => {
    const name = String(n.properties.obj ?? '')
    const line = `${cpp.indent(depth)}${cpp.name(name)} = ${cpp.expr(n.slots.value?.[0])};`
    // 照放入的順序走訪的字典（441）：整個換掉時，旁邊那一串鍵也換成字面量裡的鍵（照寫的順序）
    const keys = cpp.dictKeys(name)
    if (!keys) return [line]
    const pairs = n.slots.value?.[0]?.slots?.pairs ?? []
    return [line, `${cpp.indent(depth)}${cpp.name(keys)} = {${pairs.map((p) => cpp.expr(p.slots?.key?.[0])).join(', ')}};`]
  })
}
