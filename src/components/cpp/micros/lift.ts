/** `cpp:micros` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('micros', {
    componentId: 'cpp:micros',
    argSlots: [],
    source: 'cpp/micros',
  })
}
