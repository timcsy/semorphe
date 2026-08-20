/** `cpp:millis` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('millis', {
    componentId: 'cpp:millis',
    argSlots: [],
    source: 'cpp/millis',
  })
}
