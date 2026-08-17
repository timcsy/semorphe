/** `cpp:analog_read` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('analogRead', {
    conceptId: 'cpp:analog_read',
    argSlots: ["pin"],
    source: 'cpp/analog_read',
  })
}
