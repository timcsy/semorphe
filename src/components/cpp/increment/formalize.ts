/** `cpp:increment` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:increment', (n, f) =>
    f.k('eIncDec', { n: n.id, lhs: f.exprOf(n, 'target'), inc: n.properties?.operator === '++', post: n.properties?.position === 'postfix' }))
  // 當敘述用：運算式敘述
  r.stmt('cpp:increment', (n, f) => f.exprStmt(n))
}
