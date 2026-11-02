/**
 * `cpp:pwm_write` 的 **formalize** 路（spec 201）。契約見 `core/formalize-contract.ts`。
 *
 * `ledcWrite(腳位, duty)`——Cella 的 ESP32 模型照 arduino-esp32 3.0.7（`@cella-lang/arduino` README），第一格是**腳位**。
 * ⚠️ core 2.x 的「第一格是通道」那一代（`ledcSetup`／`ledcAttachPin`）不在模型裡：那兩顆沒有 formalize，照實標翻不出（不猜、P6）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:pwm_write', (n, f) => f.call(n, 'ledcWrite', ['target', 'duty']))
  // 當敘述用：運算式敘述
  r.stmt('cpp:pwm_write', (n, f) => f.exprStmt(n))
}
