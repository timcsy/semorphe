/** `cpp:digital_read` 的 **lift** 路——**一筆資料，不是函式**（照 `cpp/math_abs` 的形狀）。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('digitalRead', {
    componentId: 'cpp:digital_read',
    argSlots: ["pin"],
    source: 'cpp/digital_read',
  })
}
