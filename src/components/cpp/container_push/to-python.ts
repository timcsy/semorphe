/** 這顆元件寫成 Python（448）：stack／queue 放到尾端；priority_queue 用 heapq.heappush（最大堆存負數） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, atom, elementValue, elementOf } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    const v = n.slots.value?.[0]
    const k = adapterKind(py.typeOf(obj))
    const o = py.expr(obj)
    // 放進去的值照元素型別換（465：`stack<int>` 的 `push(2.5)` 放進去的是 2）
    const val = k ? elementValue(elementOf(py.typeOf(obj)), v, py) : undefined
    if (k && val === undefined) return [py.keep(n, 'needs-types', `放進 ${py.typeOf(obj)} 的值要照元素型別換，而換不了`)]
    if (k === 'stack' || k === 'queue') return [`${py.indent(depth)}${o}.append(${val})`]
    if (k === 'minheap') return [`${py.indent(depth)}${py.useImport('heapq')}.heappush(${o}, ${val})`]
    if (k === 'maxheap') return [`${py.indent(depth)}${py.useImport('heapq')}.heappush(${o}, -${atom(val!)})`]
    return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 push 還沒有對應`)]
  })
}
