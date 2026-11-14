/**
 * 這顆元件寫成 Python（465）：pair 換成 tuple——`pair<int, int> p;` → `p = (0, 0)`、`= {a, b}`／`(a, b)`／`= make_pair(a, b)` → `(a, b)`。
 * 為什麼是 tuple 不是 list：C++ 的 pair 是值（`q = p` 複製一份），tuple 不能改 ⟹ 指定、傳值都不必另外複製；
 * 改成員由成員那顆重建整個 tuple（`p.first = 7` → `p = (7, p[1])`）。
 * 每一格照自己的型別換（`pair<int, int> p = {1, 2.5}` 的 second 是 2）；元素型別限有預設值的幾種（整數、double、string）。
 * 來源是另一個 pair 的（`= q`、`= f()`）只收型別一模一樣的——不同的要逐格轉換，不猜
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { pairDeclLine } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => [`${py.indent(depth)}${pairDeclLine(n, py.name(String(n.properties.name ?? '')), [String(n.properties.type1 ?? ''), String(n.properties.type2 ?? '')], n.slots.source?.[0], py)}`])
}
