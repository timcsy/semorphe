/** `cpp:pwm_attach` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('ledcAttach', {
    componentId: 'cpp:pwm_attach',
    argSlots: ['pin', 'freq', 'bits'],
    source: 'cpp/pwm_attach',
  })
}
