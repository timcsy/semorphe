/** `cpp:block` 的 **generate** 路——獨立的 `{ … }`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:block', (node, ctx) => {
    const body = generateBody(node.children.body ?? [], ctx)
    return `${indent(ctx)}{\n${body}${indent(ctx)}}\n`
  })
}
