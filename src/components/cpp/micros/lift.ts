/** `cpp:micros` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('micros', {
    conceptId: 'cpp:micros',
    argSlots: [],
    source: 'cpp/micros',
  })
}
