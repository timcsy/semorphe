/** 這顆元件寫成 Python（453）：`v.pop_back();` → `v.pop()`。只收 vector（字串的 pop_back 在 Python 不能改原字串）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const obj = n.slots.obj?.[0]
    if (!/^(const\s+)?(std::)?vector</.test(py.typeOf(obj) ?? '')) return [py.keep(n, 'outside-subset', `${py.typeOf(obj) ?? '這個型別'} 的 pop_back 還沒有對應`)]
    return [`${py.indent(depth)}${paren(obj, py)}.pop()`]
  })
}
