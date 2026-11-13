/** 這顆元件寫成 Python（448）：`len(x) == 0`（list、deque、heapq 的 list、str 都適用） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { adapterKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.yieldsBool()
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    const t = py.typeOf(obj) ?? ''
    if (adapterKind(t) || /^(const\s+)?(std::)?(vector<|string|basic_string<)/.test(t)) return `len(${py.expr(obj)}) == 0`
    return py.keep(n, 'outside-subset', `${t || '這個容器'} 的 empty 還沒有對應`)
  })
}
