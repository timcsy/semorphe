/**
 * `cpp:touch_read` 的 **formalize** 路（spec 201）。契約見 `core/formalize-contract.ts`。
 *
 * `touchRead(腳位)`——Cella 的 ESP32 模型有它（有觸控的板子；環境輸入 `touch:<腳位>`，沒給是 75）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:touch_read', (n, f) => f.call(n, 'touchRead', ['pin']))
}
