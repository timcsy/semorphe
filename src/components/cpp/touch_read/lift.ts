/** `cpp:touch_read` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('touchRead', {
    componentId: 'cpp:touch_read',
    argSlots: ['pin'],
    source: 'cpp/touch_read',
  })
}
