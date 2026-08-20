/** `cpp:pwm_tie` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('ledcAttachPin', {
    componentId: 'cpp:pwm_tie',
    argSlots: ['pin', 'channel'],
    source: 'cpp/pwm_tie',
  })
}
