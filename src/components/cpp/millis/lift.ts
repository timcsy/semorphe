/** `cpp:millis` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('millis', {
    componentId: 'cpp:millis',
    argSlots: [],
    source: 'cpp/millis',
  })
}
