/**
 * `cpp:pulse_read` 的 **lift** 路——**一筆資料，不是函式**。
 *
 * ⚠️ 函式名是 `pulseIn`，而身分是 `cpp:pulse_read`——**名字描述語義動作，不抄語法**。
 * ⚠️ 第三個槽（`timeout`）是**可選的**，處理方式與 `cpp:tone` 的 `duration` 相同。
 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('pulseIn', {
    componentId: 'cpp:pulse_read',
    argSlots: ['pin', 'state', 'timeout'],
    source: 'cpp/pulse_read',
  })
}
