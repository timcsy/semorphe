/** 這顆元件寫成 Python（450）：set → set（走訪時由 loop_range 包 sorted） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { keyedKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const t = `${String(n.properties.unique ?? 'true') === 'false' ? 'multiset' : 'set'}<${String(n.properties.type ?? '')}>`
    if (keyedKind(t)?.kind !== 'set') return [py.keep(n, 'outside-subset', `${t} 還沒有對應`)]
    // ⏳ 字串的 set：換出來的程式走訪時包了 sorted（輸出與雜湊順序無關），而 Cella 的 Python 家族對裝字串的 set 仍帶 str.hash 的假設
    //    ⟹ 判決與 C++ 不同（多一條 assumes）。Cella 收斂這條假設之前照實保留（450 回報 cella；同 Python → C++ 09/rebuild 那一條）
    if (keyedKind(t)?.key === 'string') return [py.keep(n, 'outside-subset', 'set<string>：等 Cella 收斂 sorted 走訪時的 str.hash 假設')]
    const name = py.name(String(n.properties.name ?? ''))
    // 一段範圍建起來（`set<int> s(v.begin(), v.end())`）還沒有對應
    if (Object.keys(n.slots).some((k) => k !== 'source' && (n.slots[k]?.length ?? 0) > 0)) return [py.keep(n, 'outside-subset', '這種 set 的建法還沒有對應')]
    // `set<T> b = a;`：複製一份 ⟹ set(…)
    const src = n.slots.source?.[0]
    return [`${py.indent(depth)}${name} = ${src ? `set(${py.expr(src)})` : 'set()'}`]
  })
}
