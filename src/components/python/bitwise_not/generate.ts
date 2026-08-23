/** `python:bitwise_not` 的 **generate** 路——`~x`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:bitwise_not', (node, ctx) => {
    const inner = (node.children.operand ?? [])[0]
    // ⚠️ 括號由共用的演算法決定——`~(a + b)` 少了那對括號會變成 `~a + b`
    return `~${inner ? genChild(inner, 14, ctx) : ''}`
  })
}
