/** `cpp:ternary` 的 **formalize** 路（spec 199：6.0 量到學生的程式 11 支用條件運算式）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:ternary', (n, f) => f.k('eCond', { n: n.id, c: f.exprOf(n, 'condition'), a: f.exprOf(n, 'true_expr'), b: f.exprOf(n, 'false_expr') }))
  // 當敘述用（`cond ? a = 1 : b = 2;`）：運算式敘述（第 207 刀）
  r.stmt('cpp:ternary', (n, f) => f.exprStmt(n))
}
