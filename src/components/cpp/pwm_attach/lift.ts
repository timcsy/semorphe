/** `cpp:pwm_attach` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('ledcAttach', {
    componentId: 'cpp:pwm_attach',
    argSlots: ['pin', 'freq', 'bits'],
    source: 'cpp/pwm_attach',
  })
}
