/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { intValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const name = String(n.properties.name ?? '')
    if (!py.isUserFunction(name)) return py.keep(n, 'outside-subset', `標準函式庫的 ${name}(…) 還沒有對應`)
    // 473：C++ 進函式時照參數型別轉換（`int g(int x)` 收到 2.5 是 2）——整數截斷、bool 包 bool(…)，同指定那一路；
    // 同名的函式有幾種參數型別（多載）就認不出是哪一個 ⟹ 保留
    const pts = py.paramTypesOf(name)
    if (pts === undefined) return py.keep(n, 'outside-subset', `函式「${name}」有幾種參數型別（多載）——Python 一個名字只有一個函式`)
    return `${py.name(name)}(${(n.slots.args ?? []).map((a, i) => intValue(pts[i], py.typeOf(a), py.expr(a))).join(', ')})`
  })
}
