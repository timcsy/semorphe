/**
 * `cpp:container_pop_front` 的 **lift** 路——**一筆資料：「`pop_front` 這個方法名屬於我」**。
 *
 * ⚠️ 判別邏輯（找 `field_expression`、拆接收者）留在共用的路由器是對的，
 * 而**要回家的是宣告**。見 `cpp/vector_pop/lift.ts` 的同一個形狀。
 */
import { registerContainerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerContainerMethodComponent('pop_front', 'cpp:container_pop_front', 'cpp/container_pop_front')
}
