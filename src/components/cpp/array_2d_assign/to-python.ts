/** 這顆元件寫成 Python（459）：`a[i][j] = v` → `a[i][j] = v`（同一維那顆：值照元素型別換，整數截斷、字元保留） */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue, isChar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const value = n.slots.value?.[0]
    if (isChar(py.typeOf(n)) || isChar(py.typeOf(value))) return [py.keep(n, 'char', '改字元陣列裡的一個字元還沒有對應')]
    // obj 是一段文字（可以是 `d[a]`、`s.b`）——只收一個名字，其餘不猜它換過去長什麼樣
    const obj = String(n.properties.obj ?? '')
    if (!/^[A-Za-z_]\w*$/.test(obj)) return [py.keep(n, 'outside-subset', `改「${obj}」裡的元素還沒有對應`)]
    const o = py.name(obj)
    // 浮點放進整數陣列：C++ 隱含截斷——元素型別先問 Cella，沒給就問宣告那一顆記下的（Cella 不給這一句型別）；都不知道而值是浮點 ⟹ 保留
    const et = py.typeOf(n) ?? py.elementTypeOf(o)
    if (et === undefined && /^(const\s+)?(double|float|long double)/.test(py.typeOf(value) ?? '')) return [py.keep(n, 'needs-types', `放進 ${o} 的值是浮點，而不知道 ${o} 的元素型別`)]
    const target = `${o}[${py.expr(n.slots.row?.[0])}][${py.expr(n.slots.col?.[0])}]`
    return [`${py.indent(depth)}${target} = ${intValue(et, py.typeOf(value), py.expr(value))}`]
  })
}
