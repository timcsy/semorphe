/** `cpp:math_is_nan` 的 **lift** 路——**一筆資料，不是函式**。⚠️ `std::isnan` 也認。 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent(['isnan', 'std::isnan'], {
    componentId: 'cpp:math_is_nan',
    argSlots: ['value'],
    source: 'cpp/math_is_nan',
  })
}
