/**
 * 這顆元件寫成 Python（465）：pair 換成 tuple——`pair<int, int> p;` → `p = (0, 0)`、`= {a, b}`／`(a, b)`／`= make_pair(a, b)` → `(a, b)`。
 * 為什麼是 tuple 不是 list：C++ 的 pair 是值（`q = p` 複製一份），tuple 不能改 ⟹ 指定、傳值都不必另外複製；
 * 改成員由成員那顆重建整個 tuple（`p.first = 7` → `p = (7, p[1])`）。
 * 每一格照自己的型別換（`pair<int, int> p = {1, 2.5}` 的 second 是 2）；元素型別限有預設值的幾種（整數、double、string）。
 * 來源是另一個 pair 的（`= q`、`= f()`）只收型別一模一樣的——不同的要逐格轉換，不猜
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue, zeroOf } from '../../../languages/cpp/to-python/contract'

const key = (t: string | undefined): string => (t ?? '?').replace(/std::|const\s+|&|\s+/g, '')

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const name = py.name(String(n.properties.name ?? ''))
    const types = [String(n.properties.type1 ?? ''), String(n.properties.type2 ?? '')]
    const zeros = types.map(zeroOf)
    if (zeros.some((z) => z === undefined)) return [py.keep(n, 'outside-subset', `pair<${types.join(', ')}> 還沒有對應`)]
    const src = n.slots.source?.[0]
    const line = (v: string): string[] => [`${py.indent(depth)}${name} = ${v}`]
    if (!src) return line(`(${zeros.join(', ')})`)
    // 兩個值（`{a, b}`、`make_pair(a, b)`）：問形狀——values 槽恰好兩個，或 first／second 兩個槽
    const parts = src.slots?.values?.length === 2 ? src.slots.values
      : src.slots?.first?.length && src.slots?.second?.length ? [src.slots.first[0], src.slots.second[0]] : undefined
    if (parts) return line(`(${parts.map((v, k) => intValue(types[k], py.typeOf(v), py.expr(v))).join(', ')})`)
    if (key(py.typeOf(src)) !== key(`pair<${types.join(',')}>`)) return [py.keep(n, 'needs-types', `放進 pair<${types.join(', ')}> 的值型別是 ${py.typeOf(src) ?? '不知道'}`)]
    return line(py.expr(src))
  })
}
