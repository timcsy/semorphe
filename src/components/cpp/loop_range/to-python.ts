/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `for (int x : v)` → for x in v（以值走訪：改 x 不影響 v，Python 的數字與字串一樣）；以參考走訪（`int& x`）會改到容器 ⟹ 保留
  r.stmt((n, py, depth) => {
    const t = String(n.properties.var_type ?? '')
    if (t.includes('&') || (n.slots.targets?.length ?? 0) > 0) return [py.keep(n, 'outside-subset', `以參考走訪（${t}）或結構化繫結還沒有對應`)]
    return [`${py.indent(depth)}for ${py.name(String(n.properties.var_name ?? 'x'))} in ${py.expr(n.slots.iterable?.[0])}:`, ...py.block(n.slots.body, depth + 1)]
  })
}
