/** 這顆元件寫成 Python（450）：`s.insert(x)` → `s.add(x)`（只收 set；map 的 insert 放的是一對） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { keyedKind, elementValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    if (keyedKind(py.typeOf(obj))?.kind !== 'set') return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個容器'} 的 insert 還沒有對應`)]
    // 放進去的值照鍵的型別換（465：`set<int>` 的 `insert(2.5)` 放進去的是 2）
    const val = elementValue(keyedKind(py.typeOf(obj))!.key, n.slots.value?.[0], py)
    if (val === undefined) return [py.keep(n, 'needs-types', `放進 ${py.typeOf(obj)} 的值要照鍵的型別換，而換不了`)]
    return [`${py.indent(depth)}${py.expr(obj)}.add(${val})`]
  })
}
