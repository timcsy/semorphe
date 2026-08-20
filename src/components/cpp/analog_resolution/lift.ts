/** `cpp:analog_resolution` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('analogReadResolution', {
    componentId: 'cpp:analog_resolution',
    argSlots: ['bits'],
    source: 'cpp/analog_resolution',
  })
}
