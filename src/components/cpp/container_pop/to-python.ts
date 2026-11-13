/** 這顆元件寫成 Python（448）：stack 尾端、queue 前端、priority_queue 堆頂 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    const k = adapterKind(py.typeOf(obj))
    const o = py.expr(obj)
    if (k === 'stack') return [`${py.indent(depth)}${o}.pop()`]
    if (k === 'queue') return [`${py.indent(depth)}${o}.popleft()`]
    if (k === 'minheap' || k === 'maxheap') return [`${py.indent(depth)}${py.useImport('heapq')}.heappop(${o})`]
    return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 pop 還沒有對應`)]
  })
}
