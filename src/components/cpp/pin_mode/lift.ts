/** `cpp:pin_mode` 的 **lift** 路——**一筆資料，不是函式**（照 `cpp/math_abs` 的形狀）。 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('pinMode', {
    componentId: 'cpp:pin_mode',
    argSlots: ["pin", "mode"],
    source: 'cpp/pin_mode',
  })
}
