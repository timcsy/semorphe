/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

/** 非負的整數字面量才換：負索引與超出範圍在 Python 有定義（從尾巴算、截斷），C++ 沒有 */
const natural = (x: SemanticNode | undefined): boolean => !!x && x.componentId.endsWith(':literal_number') && /^\d+$/.test(String(x.properties?.value))

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => {
    const obj = n.slots.obj?.[0], from = n.slots.from?.[0], to = n.slots.to?.[0]
    const t = cpp.pyType(obj)
    if (n.slots.step?.[0] || !natural(from) || !natural(to)) return cpp.keep(n, 'outside-subset', '切片：起訖不是非負的整數字面量、或有步長')
    const a = Number(from!.properties.value), b = Number(to!.properties.value)
    if (b < a) return cpp.keep(n, 'outside-subset', '切片：終點在起點之前（Python 得到空的）')
    const o = cpp.expr(obj)
    if (t === 'str') return `${o}.substr(${a}, ${b - a})`
    const ct = t?.startsWith('list[') ? cpp.cppType(t) : undefined
    if (ct) return `${ct}(${o}.begin() + ${a}, ${o}.begin() + ${b})`
    return cpp.keep(n, 'type-uncertain', `切片的對象型別（${t ?? '?'}）`)
  })
}
