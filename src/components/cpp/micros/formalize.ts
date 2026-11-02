/** `cpp:micros` 的 **formalize** 路——`micros()` 在 Cella 的板子模型裡是一般的函式呼叫（`@cella-lang/arduino` 的核心：AVR／ESP32／ESP8266 都有）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:micros', (n, f) => f.call(n, 'micros', []))
}
