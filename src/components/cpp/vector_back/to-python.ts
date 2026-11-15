/**
 * 這顆元件寫成 Python（453）：`v.back()` → `v[-1]`。只收元素是純量的 vector——
 * 元素是 vector 時 C++ 拿去初始化是複製一份、Python 是同一個 list（同 447 的 push_back），先保留。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, adapterKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    const t = py.typeOf(obj) ?? ''
    // std::deque<純量> 與 queue（475，兩個都換成 collections.deque）同樣是 `[-1]`
    if (adapterKind(t) === 'deque' || adapterKind(t) === 'queue') return `${paren(obj, py)}[-1]`
    if (!/^(const\s+)?(std::)?vector</.test(t) || /^(const\s+)?(std::)?vector<\s*(std::)?(vector|deque|string|pair|map|set)/.test(t)) {
      return py.keep(n, 'outside-subset', `${t || '這個型別'} 的 back 還沒有對應`)
    }
    return `${paren(obj, py)}[-1]`
  })
}
