/** `python:logic_not` 的 **generate** 路——前綴 `not`，後面一定要一個空格。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:logic_not', (node, ctx) => {
    // `not` 是一個【單字】不是符號，所以空格是語法的一部分而不是排版。
    return `not ${genChild((node.children.value ?? [])[0], precedence(node), ctx)}`
  })
}
