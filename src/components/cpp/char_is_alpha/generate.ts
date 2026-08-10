/**
 * `cpp:char_is_alpha` 的 **generate** 路：`isalpha(x)`
 *
 * 從 `std/cctype/generators.ts` 的四函式迴圈裡剪出來。
 * ⚠️ 那個迴圈用的鍵是 `cpp_isalpha`（積木型別），而膠囊用 **conceptId**
 * ——那正是「積木型別與元件身分是兩份會漂移的命名」那條待辦的實例。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:char_is_alpha', (node, ctx) => {
    const v = (node.children.value ?? [])[0]
    // ⚠️ 缺子節點時**不回一個看起來合理的預設值**——那是第三十三條護欄抓的形狀。
    if (!v) throw new Error('cpp:char_is_alpha 少了 value 子節點——語義樹壞了')
    return `isalpha(${generateExpression(v, ctx)})`
  })
}
