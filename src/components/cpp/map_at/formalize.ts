/** `cpp:map_at` 的 **formalize** 路（spec 194）——`m[k]` → `eIndex m k`。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:map_at', (n, f) => {
    // 名字交給 Cella 依作用域解析（eName，cella 0.1.202611052225）；沒宣告過由 Cella 判 undeclared、指回這一格。不是單一名字的照實標 unknown
    const name = String(n.properties?.obj ?? '')
    if (!/^[A-Za-z_]\w*$/.test(name)) return f.miss(n, `對應表「${name}」不是單一名字`)
    return f.k('eIndex', { n: n.id, a: f.k('eName', { n: `${n.id}/obj`, name }), i: f.exprOf(n, 'key') })
  })
  // 當敘述用（`cond ? a = 1 : b = 2;`）：運算式敘述（第 207 刀）
  r.stmt('cpp:map_at', (n, f) => f.exprStmt(n))
}
