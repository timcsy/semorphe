/** `cpp:sizeof` 的 **generate** 路——對象是型別／名字（文字 `target`）或運算式（接點 `expr`，355）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:sizeof', (node, ctx) => {
    const expr = node.slots.expr?.[0]
    if (expr) return `sizeof(${generateExpression(expr, ctx)})`
    return `sizeof(${node.properties.target ?? 'int'})`
  })
}
