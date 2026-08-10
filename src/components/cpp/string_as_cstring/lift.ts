/**
 * `cpp:string_as_cstring` 的 **lift** 路——**一筆資料**
 *
 * 原本是 `lifters/io.ts` 方法路由器裡的一個 `case`：
 * `case 'c_str': return createNode('cpp:string_as_cstring', { obj }, { （無引數） })`
 *
 * 拆開只剩三樣：**方法名、身分、引數槽名**。判別（找 field_expression、
 * 取 obj 與引數）留在共用檔。
 */
import { registerMethodConcept } from '../../../core/component/method-concepts'

export function registerLift(): void {
  registerMethodConcept('c_str', 'cpp:string_as_cstring', 'cpp/string_as_cstring', [])
}
