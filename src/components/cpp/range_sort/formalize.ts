/** `cpp:range_sort` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_sort', (n, f) => {
    const args = [f.exprOf(n, 'begin'), f.exprOf(n, 'end'), ...(f.one(n, 'comparator') ? [f.exprOf(n, 'comparator')] : [])]
    return f.k('eCall', { n: n.id, f: 'sort', args })
  })
  // 當敘述用：運算式敘述
  r.stmt('cpp:range_sort', (n, f) => f.exprStmt(n))
}
