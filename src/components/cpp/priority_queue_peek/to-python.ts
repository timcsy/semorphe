/** 這顆元件寫成 Python（448）：堆頂是 `q[0]`；最大堆存的是負數 ⟹ `-q[0]` */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, atom } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    const k = adapterKind(py.typeOf(obj))
    if (k === 'minheap') return `${atom(py.expr(obj))}[0]`
    if (k === 'maxheap') return `-${atom(py.expr(obj))}[0]`
    return py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 top 還沒有對應`)
  })
}
