/** 這顆元件寫成 Python（448）：stack／queue 放到尾端；priority_queue 用 heapq.heappush（最大堆存負數） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, atom } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    const v = n.slots.value?.[0]
    const k = adapterKind(py.typeOf(obj))
    const o = py.expr(obj)
    if (k === 'stack' || k === 'queue') return [`${py.indent(depth)}${o}.append(${py.expr(v)})`]
    if (k === 'minheap') return [`${py.indent(depth)}${py.useImport('heapq')}.heappush(${o}, ${py.expr(v)})`]
    if (k === 'maxheap') return [`${py.indent(depth)}${py.useImport('heapq')}.heappush(${o}, -${atom(py.expr(v))})`]
    return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 push 還沒有對應`)]
  })
}
