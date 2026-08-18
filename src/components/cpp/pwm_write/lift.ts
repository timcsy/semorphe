/** `cpp:pwm_write` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('ledcWrite', {
    conceptId: 'cpp:pwm_write',
    argSlots: ['target', 'duty'],
    source: 'cpp/pwm_write',
  })
}
