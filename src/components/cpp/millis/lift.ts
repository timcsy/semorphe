/** `cpp:millis` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('millis', {
    conceptId: 'cpp:millis',
    argSlots: [],
    source: 'cpp/millis',
  })
}
