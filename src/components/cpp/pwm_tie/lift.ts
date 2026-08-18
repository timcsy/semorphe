/** `cpp:pwm_tie` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('ledcAttachPin', {
    conceptId: 'cpp:pwm_tie',
    argSlots: ['pin', 'channel'],
    source: 'cpp/pwm_tie',
  })
}
