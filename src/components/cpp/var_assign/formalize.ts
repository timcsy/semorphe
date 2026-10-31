/** `cpp:var_assign` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:var_assign', (n, f) => f.k('eAssign', { n: n.id, lhs: f.exprOf(n, 'target'), op: null, e: f.exprOf(n, 'value') }))
  // 當敘述用：運算式敘述
  r.stmt('cpp:var_assign', (n, f) => f.exprStmt(n))
}
