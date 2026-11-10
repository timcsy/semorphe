/** `cpp:block` 的 **generate** 路——獨立的 `{ … }`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:block', (node, ctx) => {
    const head = `${indent(ctx)}{\n`
    trackOwnText(ctx, head)
    const body = generateBody(node.slots.body ?? [], indented(ctx))
    return `${head}${body}${indent(ctx)}}\n`
  })
}
