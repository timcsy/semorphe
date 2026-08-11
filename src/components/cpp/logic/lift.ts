/**
 * `cpp:logic` 的 **lift** 路——**一筆登錄**
 *
 * 「這是不是 `binary_expression`」是 C++ 語法的知識，留在共用檔；
 * **「這些符號屬於我」是這顆元件的宣告。**
 */
import { registerBinaryOperator } from '../../../core/component/binary-operators'

export function registerLift(): void {
  registerBinaryOperator(["&&", "||"], 'cpp:logic', 'cpp/logic')
}
