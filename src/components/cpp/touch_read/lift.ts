/** `cpp:touch_read` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('touchRead', {
    componentId: 'cpp:touch_read',
    argSlots: ['pin'],
    source: 'cpp/touch_read',
  })
}
