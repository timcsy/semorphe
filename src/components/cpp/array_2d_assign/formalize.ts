/** `cpp:array_2d_assign` 的 **formalize** 路（spec 199：6.0 量到學生的程式 12 支寫二維陣列的一格）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:array_2d_assign', (n, f) => {
    // 名字交給 Cella 依作用域解析（eName，cella 0.1.202611052225）；沒宣告過由 Cella 判 undeclared、指回這一格。不是單一名字的照實標 unknown
    const name = String(n.properties?.obj ?? '')
    if (!/^[A-Za-z_]\w*$/.test(name)) return f.miss(n, `陣列名「${name}」不是單一名字`)
    const row = f.k('eIndex', { n: `${n.id}/row`, a: f.k('eName', { n: `${n.id}/obj`, name }), i: f.exprOf(n, 'row') })
    return f.k('eAssign', { n: n.id, lhs: f.k('eIndex', { n: `${n.id}/lhs`, a: row, i: f.exprOf(n, 'col') }), op: null, e: f.exprOf(n, 'value') })
  })
  r.stmt('cpp:array_2d_assign', (n, f) => f.exprStmt(n))
}
