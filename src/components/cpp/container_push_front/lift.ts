/**
 * `cpp:container_push_front` 的 **lift** 路——**一筆資料：「`push_front` 這個方法名屬於我」**。
 *
 * ⚠️ 判別邏輯（找 `field_expression`、拆接收者與引數）留在共用的路由器是對的，
 * 而**要回家的是宣告**。與同族那顆移除前端元素的元件同一個形狀。
 */
import { registerContainerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerContainerMethodComponent('push_front', 'cpp:container_push_front', 'cpp/container_push_front')
}
