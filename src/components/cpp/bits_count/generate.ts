/** `cpp:bits_count` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:bits_count', (node, ctx) => {
    const value = node.children.value?.[0]
    // 引數是必要的（宣告 min: 1）——缺了就補 `0`，那至少編得過而且答案顯然
    return `__builtin_popcount(${value ? generateExpression(value, ctx) : '0'})`
  })
}
