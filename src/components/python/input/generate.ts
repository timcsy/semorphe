/** `python:input` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:input', (node, ctx) => {
    const p = (node.children.prompt ?? [])[0]
    // 沒有提示就產裸的 `input()` —— 不要自作主張補一個空字串，
    // 那會讓 `input()` 與 `input("")` 在來回轉換後變成同一個。
    return p ? `input(${generateExpression(p, ctx)})` : 'input()'
  })
}
