/** `cpp:var_assign_compound` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:var_assign_compound', (n, f) => {
    const op = f.binOp(String(n.properties?.operator ?? '').replace(/=$/, ''))
    if (!op) return f.miss(n, `複合賦值「${String(n.properties?.operator)}」還沒有對應`)
    return f.k('eAssign', { n: n.id, lhs: f.exprOf(n, 'target'), op: f.k(op), e: f.exprOf(n, 'value') })
  })
  // 當敘述用：運算式敘述
  r.stmt('cpp:var_assign_compound', (n, f) => f.exprStmt(n))
}
