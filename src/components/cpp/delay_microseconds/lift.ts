/** `cpp:delay_microseconds` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('delayMicroseconds', {
    componentId: 'cpp:delay_microseconds',
    argSlots: ['us'],
    source: 'cpp/delay_microseconds',
  })
}
