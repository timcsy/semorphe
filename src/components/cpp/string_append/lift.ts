/**
 * `cpp:string_append` 的 **lift** 路——**一筆資料**
 *
 * 原本是 `lifters/io.ts` 方法路由器裡的一個 `case`：
 * `case 'append': return createNode('cpp:string_append', { obj }, { value })`
 *
 * 拆開只剩三樣：**方法名、身分、引數槽名**。判別（找 field_expression、
 * 取 obj 與引數）留在共用檔。
 */
import { registerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerMethodComponent('append', 'cpp:string_append', 'cpp/string_append', ["value"])
}
