/** 這顆元件寫成 Python（450）：有序的 map → dict（走訪時由 loop_range 包 sorted） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { keyedKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const p = n.properties
    const t = `${String(p.ordered ?? 'true') === 'false' ? 'unordered_map' : String(p.unique ?? 'true') === 'false' ? 'multimap' : 'map'}<${String(p.key_type ?? '')}, ${String(p.value_type ?? '')}>`
    if (keyedKind(t)?.kind !== 'map') return [py.keep(n, 'outside-subset', `${t} 還沒有對應`)]
    const name = py.name(String(p.name ?? ''))
    py.noteElementType(name, String(p.value_type ?? ''))
    if (Object.keys(n.slots).some((k) => k !== 'source' && (n.slots[k]?.length ?? 0) > 0)) return [py.keep(n, 'outside-subset', '這種 map 的建法還沒有對應')]
    // `map<K, V> b = a;`：C++ 是複製一份 ⟹ dict(…)（Python 的 `b = a` 是同一個 dict）
    const src = n.slots.source?.[0]
    return [`${py.indent(depth)}${name} = ${src ? `dict(${py.expr(src)})` : '{}'}`]
  })
}
