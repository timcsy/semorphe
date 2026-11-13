/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    if (n.properties.method !== 'push_back') return [py.keep(n, 'outside-subset', `.${String(n.properties.method)}(…) 還沒有對應`)]
    // 推進去的是一個 vector：C++ 放進去的是複製的一份，Python 的 append 放的是同一個 list ⟹ `list(…)`（447）
    const v = n.slots.value?.[0]
    const val = /^(const\s+)?(std::)?vector</.test(py.typeOf(v) ?? '') ? `list(${py.expr(v)})` : py.expr(v)
    return [`${py.indent(depth)}${paren(n.slots.obj?.[0], py)}.append(${val})`]
  })
}
