/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `int a[R][C];` → 每一列各自一個 list（不是 [[0] * C] * R——那會讓每一列是同一個 list）
  r.stmt((n, py, depth) => {
    const name = py.name(String(n.properties.name ?? ''))
    const t = String(n.properties.type ?? '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : null
    // 元素型別記下來（459）：`a[i] = 7.9` 放進整數陣列要截斷，而 Cella 不給那一句型別
    if (zero !== null) py.noteElementType(name, t)
    if (zero === null) return [py.keep(n, 'outside-subset', `${t} 二維陣列還沒有對應`)]
    const init = n.slots.values ?? []
    if (init.length > 0) {
      // `{{1, 2}, {3, 4}}` → 每一列寫出來。只收寫滿的整數初值：沒寫滿要補 0，double 的整數字面量到 Python 會印成整數
      const rows = Number(n.slots.rows?.[0]?.properties?.value), cols = Number(n.slots.cols?.[0]?.properties?.value)
      const full = zero === '0' && init.length === rows && init.every((row) => row.slots.values?.length === cols)
      if (!full) return [py.keep(n, 'outside-subset', '二維陣列的初值沒有逐列寫滿（或不是整數）')]
      return [`${py.indent(depth)}${name} = [${init.map((row) => `[${row.slots.values.map((v) => py.expr(v)).join(', ')}]`).join(', ')}]`]
    }
    return [`${py.indent(depth)}${name} = [[${zero}] * ${paren(n.slots.cols?.[0], py)} for _ in range(${py.expr(n.slots.rows?.[0])})]`]
  })
}
