/**
 * 這顆元件寫成 Python（450）：走訪 map 拿到的那一對（`std::pair<const K, V>`）——Python 是 `(k, v)` 的 tuple
 * ⟹ `.first` → `[0]`、`.second` → `[1]`。其餘的 struct／pair 還沒有對應。
 * 當指定目標（`p.second = …`）不換：tuple 不能改
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { atom } from '../../../languages/cpp/to-python/contract'

const PAIR = /^(const\s+)?(std::)?pair\s*</
export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    const m = String(n.properties.member ?? '')
    if (!PAIR.test(py.typeOf(obj) ?? '') || (m !== 'first' && m !== 'second')) return py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '結構'} 的成員還沒有對應`)
    return `${atom(py.expr(obj))}[${m === 'first' ? 0 : 1}]`
  })
  r.target((n, py) => ({ text: py.keep(n, 'outside-subset', `改 ${py.typeOf(n.slots.obj?.[0]) ?? '結構'} 的成員還沒有對應`) }))
}
