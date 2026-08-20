/** `cpp:analog_write` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('analogWrite', {
    componentId: 'cpp:analog_write',
    argSlots: ["pin", "value"],
    source: 'cpp/analog_write',
  })
}
