/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // `for (int x : v)` → for x in v（以值走訪：改 x 不影響 v，Python 的數字與字串一樣）；以參考走訪（`int& x`）會改到容器 ⟹ 保留
  r.stmt((n, py, depth) => {
    const t = String(n.properties.var_type ?? '')
    if (t.includes('&') || (n.slots.targets?.length ?? 0) > 0) return [py.keep(n, 'outside-subset', `以參考走訪（${t}）或結構化繫結還沒有對應`)]
    const x = py.name(String(n.properties.var_name ?? 'x'))
    // 以值走訪一個裝 vector 的容器：每一圈 C++ 拿到的是複製的一份，Python 拿到的是同一個 list ⟹ 本體第一行先複製（447）
    const copies = /vector/.test(t) || (/^(const\s+)?auto$/.test(t.trim()) && /vector\s*<\s*(const\s+)?(std::)?vector/.test(py.typeOf(n.slots.iterable?.[0]) ?? ''))
    return [`${py.indent(depth)}for ${x} in ${py.expr(n.slots.iterable?.[0])}:`, ...(copies ? [`${py.indent(depth + 1)}${x} = list(${x})`] : []), ...py.block(n.slots.body, depth + 1)]
  })
}
