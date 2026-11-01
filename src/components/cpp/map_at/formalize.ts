/** `cpp:map_at` 的 **formalize** 路（spec 194）——`m[k]` → `eIndex m k`。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:map_at', (n, f) => {
    const x = f.declOf(`${n.id}#obj`)
    if (!x) return f.miss(n, `對應表「${String(n.properties?.obj)}」指不到宣告（或不是單一名字）`)
    return f.k('eIndex', { n: n.id, a: f.k('eVar', { n: `${n.id}/obj`, x }), i: f.exprOf(n, 'key') })
  })
  // 當敘述用（`cond ? a = 1 : b = 2;`）：運算式敘述（第 207 刀）
  r.stmt('cpp:map_at', (n, f) => f.exprStmt(n))
}
