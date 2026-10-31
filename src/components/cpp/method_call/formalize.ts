/** `cpp:method_call` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 通用方法呼叫：接收者是接點（`m[k].f()` 的 `m[k]` 是一棵樹）
  r.expr('cpp:method_call', (n, f) => f.k('eMCall', { n: n.id, obj: f.exprOf(n, 'obj'), arrow: false, f: String(n.properties?.method ?? ''), args: (n.slots?.args ?? []).map((c) => f.expr(c)) }))
  // 當敘述用：運算式敘述
  r.stmt('cpp:method_call', (n, f) => f.exprStmt(n))
}
