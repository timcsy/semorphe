/** `cpp:analog_read` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('analogRead', {
    componentId: 'cpp:analog_read',
    argSlots: ["pin"],
    source: 'cpp/analog_read',
  })
}
