/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, elementValue, elementOf } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    if (n.properties.method !== 'push_back') return [py.keep(n, 'outside-subset', `.${String(n.properties.method)}(…) 還沒有對應`)]
    // 放進去的值照元素型別換（465：`vector<int>` 的 `push_back(2.5)` 放進去的是 2；之前原樣 append 2.5）；
    // 元素是 vector：C++ 放進去的是複製的一份，Python 的 append 放的是同一個 list ⟹ `list(…)`（447）
    const v = n.slots.value?.[0]
    const elem = elementOf(py.typeOf(n.slots.obj?.[0]))
    const val = elem === undefined ? (/^(const\s+)?(std::)?vector</.test(py.typeOf(v) ?? '') ? `list(${py.expr(v)})` : undefined) ?? (/^(const\s+)?(std::)?(double|float)/.test(py.typeOf(v) ?? '') ? undefined : py.expr(v)) : elementValue(elem, v, py)
    if (val === undefined) return [py.keep(n, 'needs-types', `放進 ${py.typeOf(n.slots.obj?.[0]) ?? '這個容器'} 的值要照元素型別換，而換不了`)]
    return [`${py.indent(depth)}${paren(n.slots.obj?.[0], py)}.append(${val})`]
  })
}
