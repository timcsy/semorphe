/** `cpp:pwm_open` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('ledcSetup', {
    conceptId: 'cpp:pwm_open',
    argSlots: ['channel', 'freq', 'bits'],
    source: 'cpp/pwm_open',
  })
}
