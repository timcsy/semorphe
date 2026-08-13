/** `cpp:initializer_list` 的 **generate** 路——從 `declarations.ts` 原封剪過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:initializer_list', (node, ctx) => {
    const values = node.children.values ?? []
    return `{${values.map((v) => generateExpression(v, ctx)).join(', ')}}`
  })
}
