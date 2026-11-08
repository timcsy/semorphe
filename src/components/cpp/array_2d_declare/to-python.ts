/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { paren } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `int a[R][C];` → 每一列各自一個 list（不是 [[0] * C] * R——那會讓每一列是同一個 list）
  r.stmt((n, py, depth) => {
    const name = py.name(String(n.properties.name ?? ''))
    const t = String(n.properties.type ?? '')
    const zero = /^(int|long|long long|short)$/.test(t) ? '0' : t === 'double' ? '0.0' : null
    if (zero === null) return [py.keep(n, 'outside-subset', `${t} 二維陣列還沒有對應`)]
    if ((n.slots.values?.length ?? 0) > 0) return [py.keep(n, 'outside-subset', '二維陣列的初值還沒有對應')]
    return [`${py.indent(depth)}${name} = [[${zero}] * ${paren(n.slots.cols?.[0], py)} for _ in range(${py.expr(n.slots.rows?.[0])})]`]
  })
}
