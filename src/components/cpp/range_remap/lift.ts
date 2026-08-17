/** `cpp:range_remap` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('map', {
    conceptId: 'cpp:range_remap',
    argSlots: ["value", "from_low", "from_high", "to_low", "to_high"],
    source: 'cpp/range_remap',
  })
}
