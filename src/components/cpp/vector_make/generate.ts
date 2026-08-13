/** `cpp:vector_make` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:vector_make', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const size = (node.children.size ?? [])[0]
    const fill = (node.children.fill ?? [])[0]
    const args = [size, fill].filter(Boolean).map((n) => generateExpression(n!, ctx))
    return `vector<${type}>(${args.join(', ')})`
  })
}
