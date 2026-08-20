/**
 * `cpp:priority_queue_peek` 的 **lift** 路——**「`priority_queue.top()` 是我」**
 *
 * ⚠️ 登錄的是**依型別分派**的那張表（第三張）。`top` 這個方法名在別的型別上
 * 是別顆元件，所以判別必須帶型別。
 *
 * **型別查不到時不猜**——留在通用版。猜一個錯的專屬身分比誠實降級更糟。
 */
import { registerTypedMethodConcept } from '../../../core/component/method-components'

export function registerLift(): void {
  registerTypedMethodConcept('priority_queue', 'top', 'cpp:priority_queue_peek', 'cpp/priority_queue_peek')
}
