/** `cpp:pointer_assign` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:pointer_assign', (n, f) => {
    const x = f.declOf(`${n.id}#obj`)
    if (!x) return f.miss(n, `指標名「${String(n.properties?.obj)}」指不到宣告（或不是單一名字）`)
    return f.k('eAssign', { n: n.id, lhs: f.k('eDeref', { n: `${n.id}/lhs`, a: f.k('eVar', { n: `${n.id}/obj`, x }) }), op: null, e: f.exprOf(n, 'value') })
  })
  // 當敘述用：運算式敘述
  r.stmt('cpp:pointer_assign', (n, f) => f.exprStmt(n))
}
