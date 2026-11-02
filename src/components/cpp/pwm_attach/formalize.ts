/**
 * `cpp:pwm_attach` 的 **formalize** 路（spec 201）。契約見 `core/formalize-contract.ts`。
 *
 * `ledcAttach(腳位, 頻率, 解析度)`——arduino-esp32 3.x 的一步到位；Cella 的 ESP32 模型（3.0.7）有它。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:pwm_attach', (n, f) => f.call(n, 'ledcAttach', ['pin', 'freq', 'bits']))
  // 當敘述用：運算式敘述
  r.stmt('cpp:pwm_attach', (n, f) => f.exprStmt(n))
}
