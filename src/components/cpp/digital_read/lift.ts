/** `cpp:digital_read` 的 **lift** 路——**一筆資料，不是函式**（照 `cpp/math_abs` 的形狀）。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('digitalRead', {
    componentId: 'cpp:digital_read',
    argSlots: ["pin"],
    source: 'cpp/digital_read',
  })
}
