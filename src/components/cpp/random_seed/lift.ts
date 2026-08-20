/**
 * `cpp:random_seed` 的 **lift** 路——**一筆資料，不是函式**
 *
 * 原本是 `lifters/io.ts` 裡的一個分支：
 *
 * ```ts
 * if (funcName === 'srand') {
 *   const … = argChildren[i] ? ctx.lift(argChildren[i]) : null
 *   return createNode('cpp:random_seed', {}, { seed })
 * }
 * ```
 *
 * 拆開只剩三樣東西：**函式名、身分、引數槽名**。判別邏輯
 * （找 `call_expression`、依序取引數）留在共用檔，資料回家。
 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('srand', {
    componentId: 'cpp:random_seed',
    argSlots: ["seed"],
    source: 'cpp/random_seed',
  })
}
