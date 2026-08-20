/** `python:negate` 的 **generate** 路——前綴負號，**不加空格**。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:negate', (node, ctx) => {
    // 與 `not` 不同：`-` 是符號，`-x` 不需要空格。
    return `-${genChild((node.children.value ?? [])[0], precedence(node), ctx)}`
  })
}
