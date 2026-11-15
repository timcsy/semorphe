/** 這顆元件寫成 Python（475）：std::deque 的 `pop_front()` → `popleft()` */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind, paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    if (adapterKind(py.typeOf(obj)) !== 'deque') return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 pop_front 還沒有對應`)]
    return [`${py.indent(depth)}${paren(obj, py)}.popleft()`]
  })
}
