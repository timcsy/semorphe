/** `cpp:delay_microseconds` 的 **formalize** 路——`delayMicroseconds(us)` 在 Cella 的板子模型裡是一般的函式呼叫（`@cella-lang/arduino` 的核心：AVR／ESP32／ESP8266 都有）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:delay_microseconds', (n, f) => f.call(n, 'delayMicroseconds', ['us']))
  // 當敘述用：運算式敘述
  r.stmt('cpp:delay_microseconds', (n, f) => f.exprStmt(n))
}
