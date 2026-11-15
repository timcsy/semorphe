/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren, intValue, pairElements, zeroOf } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = py.name(String(n.properties.name ?? ''))
    const t = String(n.properties.type ?? '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : t === 'bool' ? 'False' : null
    // 元素型別記下來（459）：`a[i] = 7.9` 放進整數陣列要截斷，而 Cella 不給那一句型別
    if (zero !== null) py.noteElementType(name, t)
    // vector 的陣列（鄰接串列 `vector<int> g[N]`，463）：每一格各自一個空 list（不是 [[]] * N——那會讓每一格是同一個 list）。
    // 元素型別限 vector 那顆換得過去的幾種；有初值的保留
    const vecElem = t.match(/^(?:std::)?vector\s*<\s*(int|long|long long|short|double|(?:std::)?string)\s*>$/)
    if (vecElem && n.slots.size?.[0] && !(n.slots.values ?? []).length) {
      py.noteElementType(name, t)
      return [`${py.indent(depth)}${name} = [[] for _ in range(${py.expr(n.slots.size[0])})]`]
    }
    // pair 的陣列（465）：pair 換成 tuple、tuple 不能改 ⟹ `[(0, 0)] * N` 每一格是同一個 tuple 也沒有差別（改一格的成員是換掉那一格）。
    // 元素型別限有預設值的幾種（整數、double、string）；有初值的保留
    const el = pairElements(t)
    const z = el ? el.map(zeroOf) : undefined
    if (z && z.every((x) => x !== undefined) && n.slots.size?.[0] && !(n.slots.values ?? []).length) {
      py.noteElementType(name, t)
      return [`${py.indent(depth)}${name} = [(${z.join(', ')})] * ${paren(n.slots.size[0], py)}`]
    }
    if (zero === null) return [py.keep(n, 'outside-subset', `${t} 陣列還沒有對應`)]
    const size = n.slots.size?.[0]
    const vals = (n.slots.values ?? []).map((v) => intValue(py, t, v))
    if (!size) return [`${py.indent(depth)}${name} = [${vals.join(', ')}]`]
    if (vals.length === 0) return [`${py.indent(depth)}${name} = [${zero}] * ${paren(size, py)}`]
    // 部分初值（`int a[5] = {1, 2}`）：其餘補 0
    return [`${py.indent(depth)}${name} = [${vals.join(', ')}] + [${zero}] * (${py.expr(size)} - ${vals.length})`]
  })
}
