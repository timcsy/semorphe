/** `cpp:analog_resolution` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('analogReadResolution', {
    componentId: 'cpp:analog_resolution',
    argSlots: ['bits'],
    source: 'cpp/analog_resolution',
  })
}
