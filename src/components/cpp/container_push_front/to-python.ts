/** 這顆元件寫成 Python（475）：std::deque 的 `push_front(x)` → `appendleft(x)`；放進去的值照元素型別換 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, elementValue, elementOf, paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    const t = py.typeOf(obj)
    if (adapterKind(t) !== 'deque') return [py.keep(n, 'outside-subset', `${t ?? '這個容器'} 的 push_front 還沒有對應`)]
    const val = elementValue(elementOf(t), n.slots.value?.[0], py)
    if (val === undefined) return [py.keep(n, 'needs-types', `放進 ${t} 的值要照元素型別換，而換不了`)]
    return [`${py.indent(depth)}${paren(obj, py)}.appendleft(${val})`]
  })
}
