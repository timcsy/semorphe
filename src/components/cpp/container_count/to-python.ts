/** 這顆元件寫成 Python（450）：map／set 的 `count(k)` → `int(k in m)`（有序、不重複的容器只會是 0 或 1） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { keyedKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    if (!keyedKind(py.typeOf(obj))) return py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 count 還沒有對應`)
    return `int(${py.expr(n.slots.key?.[0])} in ${py.expr(obj)})`
  })
}
