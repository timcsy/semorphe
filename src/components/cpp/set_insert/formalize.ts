/** `cpp:set_insert` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:set_insert', (n, f) =>
    f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: f.identMacro(String(n.properties?.method ?? 'insert')), args: (n.slots?.value ?? []).map((c) => f.expr(c)) }))
  // 當敘述用：運算式敘述
  r.stmt('cpp:set_insert', (n, f) => f.exprStmt(n))
}
