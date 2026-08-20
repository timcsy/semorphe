/**
 * `cpp:io_tie` 的 **lift** 路——**一筆資料：「`tie` 這個方法名屬於我」**
 *
 * ⚠️ 登錄的是**一般方法表**（`methodConceptFor`），不是容器方法表。
 * 接收者（`cin`／`cout`）進 `obj` 屬性，引數（`nullptr`／`0`／`&cout`）進 `value`
 * ——引數保留而不丟掉，因為 `cin.tie(&cout)` 是**重新綁定**，與解除不同。
 */
import { registerMethodConcept } from '../../../core/component/method-components'

export function registerLift(): void {
  registerMethodConcept('tie', 'cpp:io_tie', 'cpp/io_tie', ['value'])
}
