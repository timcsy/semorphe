/** `cpp:exception_make` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:exception_make', (node, ctx) => {
    const kind = String(node.properties.kind ?? 'runtime_error')
    const msg = (node.children.message ?? [])[0]
    return msg ? `${kind}(${generateExpression(msg, ctx)})` : `${kind}("")`
  })
}
