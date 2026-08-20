/**
 * `cpp:string_size` 的 **lift** 路——**一筆資料**
 *
 * 原本是 `lifters/io.ts` 方法路由器裡的一個 `case`：
 * `case 'length': return createNode('cpp:string_size', { obj }, { （無引數） })`
 *
 * 拆開只剩三樣：**方法名、身分、引數槽名**。判別（找 field_expression、
 * 取 obj 與引數）留在共用檔。
 */
import { registerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerMethodComponent('length', 'cpp:string_size', 'cpp/string_size', [])
}
