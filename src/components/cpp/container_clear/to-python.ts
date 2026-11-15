/**
 * 這顆元件寫成 Python（469）：`x.clear();` → `x.clear()`——list（vector）、dict／set（map、set、unordered_*）、
 * deque／list（stack、queue、priority_queue）都有同名、同樣原地清空的方法。字串不收（Python 的字串不能原地改）。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, keyedKind, adapterKind } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    const t = py.typeOf(obj) ?? ''
    if (!keyedKind(t) && !adapterKind(t) && !/^(const\s+)?(std::)?vector</.test(t)) return [py.keep(n, 'outside-subset', `${t || '這個型別'} 的 clear 還沒有對應`)]
    return [`${py.indent(depth)}${paren(obj, py)}.clear()`]
  })
}
