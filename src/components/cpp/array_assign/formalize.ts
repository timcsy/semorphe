/** `cpp:array_assign` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:array_assign', (n, f) => {
    // 名字交給 Cella 依作用域解析（eName，cella 0.1.202611052225）；沒宣告過由 Cella 判 undeclared、指回這一格。不是單一名字的照實標 unknown
    const name = String(n.properties?.obj ?? '')
    if (!/^[A-Za-z_]\w*$/.test(name)) return f.miss(n, `陣列名「${name}」不是單一名字`)
    return f.k('eAssign', { n: n.id, lhs: f.k('eIndex', { n: `${n.id}/lhs`, a: f.k('eName', { n: `${n.id}/obj`, name }), i: f.exprOf(n, 'index') }), op: null, e: f.exprOf(n, 'value') })
  })
  // 當敘述用：運算式敘述
  r.stmt('cpp:array_assign', (n, f) => f.exprStmt(n))
}
