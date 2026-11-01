/** `cpp:map_assign` 的 **formalize** 路（spec 194）——`m[k] = v;` → `eAssign (eIndex m k) v`。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`，cella 0.1.202610312349 起有這些容器）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:map_assign', (n, f) => {
    const x = f.declOf(`${n.id}#obj`)
    if (!x) return f.miss(n, `對應表「${String(n.properties?.obj)}」指不到宣告（或不是單一名字）`)
    return f.k('eAssign', { n: n.id, lhs: f.k('eIndex', { n: `${n.id}/lhs`, a: f.k('eVar', { n: `${n.id}/obj`, x }), i: f.exprOf(n, 'key') }), op: null, e: f.exprOf(n, 'value') })
  })
  r.stmt('cpp:map_assign', (n, f) => f.exprStmt(n))
}
