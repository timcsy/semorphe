/** `cpp:array_2d_assign` 的 **formalize** 路（spec 199：6.0 量到學生的程式 12 支寫二維陣列的一格）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:array_2d_assign', (n, f) => {
    const x = f.declOf(`${n.id}#obj`)
    if (!x) return f.miss(n, `陣列名「${String(n.properties?.obj)}」指不到宣告（或不是單一名字）`)
    const row = f.k('eIndex', { n: `${n.id}/row`, a: f.k('eVar', { n: `${n.id}/obj`, x }), i: f.exprOf(n, 'row') })
    return f.k('eAssign', { n: n.id, lhs: f.k('eIndex', { n: `${n.id}/lhs`, a: row, i: f.exprOf(n, 'col') }), op: null, e: f.exprOf(n, 'value') })
  })
  r.stmt('cpp:array_2d_assign', (n, f) => f.exprStmt(n))
}
