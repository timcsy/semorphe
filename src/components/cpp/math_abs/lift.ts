/**
 * `cpp:math_abs` 的 **lift** 路——**一筆資料，不是函式**
 *
 * 原本是 `lifters/io.ts` 裡的一個分支：
 *
 * ```ts
 * if (funcName === 'abs') {
 *   const … = argChildren[i] ? ctx.lift(argChildren[i]) : null
 *   return createNode('cpp:math_abs', {}, { value })
 * }
 * ```
 *
 * 拆開只剩三樣東西：**函式名、身分、引數槽名**。判別邏輯
 * （找 `call_expression`、依序取引數）留在共用檔，資料回家。
 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('abs', {
    componentId: 'cpp:math_abs',
    argSlots: ["value"],
    source: 'cpp/math_abs',
  })
}
