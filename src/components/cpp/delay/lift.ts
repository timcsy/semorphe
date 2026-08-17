/** `cpp:delay` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('delay', {
    conceptId: 'cpp:delay',
    argSlots: ["ms"],
    source: 'cpp/delay',
  })
}
