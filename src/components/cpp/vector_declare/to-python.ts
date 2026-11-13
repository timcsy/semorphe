/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = py.name(String(n.properties.name ?? ''))
    const t = String(n.properties.type ?? '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : /string/.test(t) ? '""' : null
    // vector<vector<T>>（447）：空的 → `[]`；給個數 → 每一格各自一個新的 list（`[[]] * n` 會讓 n 格是同一個 list）
    const inner = t.match(/^(?:std::)?vector\s*<\s*(int|long|long long|short|double|(?:std::)?string)\s*>$/)
    if (inner && Object.keys(n.slots).every((k) => k === 'size' || !(n.slots[k]?.length))) {
      return [n.slots.size?.length ? `${py.indent(depth)}${name} = [[] for _ in range(${py.expr(n.slots.size[0])})]` : `${py.indent(depth)}${name} = []`]
    }
    if (zero === null) return [py.keep(n, 'outside-subset', `vector<${t}> 還沒有對應`)]
    if (n.slots.values?.length) return [`${py.indent(depth)}${name} = [${n.slots.values.map((v) => py.expr(v)).join(', ')}]`]
    // `vector<T> b = 運算式;`（447）：C++ 是複製一份 ⟹ `list(…)`（另一個 vector、回傳參照參數的函式，Python 都會給同一個 list）
    const src = n.slots.source?.[0]
    if (src && !n.slots.source_end?.length) return [`${py.indent(depth)}${name} = list(${py.expr(src)})`]
    // `vector<T> v(n, x);`：元素是數字或字串（Python 裡不能改）⟹ `[x] * n` 每格是同一個值也沒有差別
    const fill = n.slots.fill?.[0]
    if (fill && n.slots.size?.length) return [`${py.indent(depth)}${name} = [${py.expr(fill)}] * ${paren(n.slots.size[0], py)}`]
    if (n.slots.size?.length) return [`${py.indent(depth)}${name} = [${zero}] * ${paren(n.slots.size[0], py)}`]
    if (Object.keys(n.slots).some((k) => k !== 'values' && k !== 'size' && (n.slots[k]?.length ?? 0) > 0)) return [py.keep(n, 'outside-subset', '這種 vector 的建法還沒有對應')]
    return [`${py.indent(depth)}${name} = []`]
  })
}
