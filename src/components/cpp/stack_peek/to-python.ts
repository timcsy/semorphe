/** 這顆元件寫成 Python（448）：list 的最後一個 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    if (adapterKind(py.typeOf(obj)) !== 'stack') return py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 top 還沒有對應`)
    return `${paren(obj, py)}[-1]`
  })
}
