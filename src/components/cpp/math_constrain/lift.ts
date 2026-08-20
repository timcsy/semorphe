/** `cpp:math_constrain` 的 **lift** 路——**一筆資料，不是函式**。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('constrain', {
    componentId: 'cpp:math_constrain',
    argSlots: ['value', 'low', 'high'],
    source: 'cpp/math_constrain',
  })
}
