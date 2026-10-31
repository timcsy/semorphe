/** `cpp:analog_write` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // Arduino 的核心：腳位、時間、聲音——在 Cella 都是一般的函式呼叫（`@cella-lang/arduino` 的 README）
  r.expr('cpp:analog_write', (n, f) => f.call(n, 'analogWrite', ['pin', 'value']))
  // 當敘述用：運算式敘述
  r.stmt('cpp:analog_write', (n, f) => f.exprStmt(n))
}
