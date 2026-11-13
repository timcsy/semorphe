/** 這顆元件寫成 Python（450）：`s.insert(x)` → `s.add(x)`（只收 set；map 的 insert 放的是一對） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { keyedKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    if (keyedKind(py.typeOf(obj))?.kind !== 'set') return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 insert 還沒有對應`)]
    return [`${py.indent(depth)}${py.expr(obj)}.add(${py.expr(n.slots.value?.[0])})`]
  })
}
