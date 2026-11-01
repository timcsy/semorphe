/** `cpp:func_call` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:func_call', (n, f) =>
    f.k('eCall', { n: n.id, f: f.identMacro(String(n.properties?.name ?? '')), args: (n.slots?.args ?? []).map((c) => f.expr(c)) }))
  // 當敘述用：運算式敘述
  r.stmt('cpp:func_call', (n, f) => f.exprStmt(n))
}
