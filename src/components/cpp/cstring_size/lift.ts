/**
 * `cpp:cstring_size` 的 **lift** 路——**一筆資料，不是函式**
 *
 * 原本是 `lifters/io.ts` 裡的一個分支：
 *
 * ```ts
 * if (funcName === 'strlen') {
 *   const … = argChildren[i] ? ctx.lift(argChildren[i]) : null
 *   return createNode('cpp:cstring_size', {}, { str })
 * }
 * ```
 *
 * 拆開只剩三樣東西：**函式名、身分、引數槽名**。判別邏輯
 * （找 `call_expression`、依序取引數）留在共用檔，資料回家。
 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('strlen', {
    conceptId: 'cpp:cstring_size',
    argSlots: ["str"],
    來源: 'cpp/cstring_size',
  })
}
