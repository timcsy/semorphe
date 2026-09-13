/** `python:compare_chain` 的 **generate** 路——`a < b < c`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:compare_chain', (node, ctx) => {
    const prec = precedence(node)
    const a = genChild((node.slots.left ?? [])[0], prec, ctx)
    const b = genChild((node.slots.middle ?? [])[0], prec + 1, ctx)
    const c = genChild((node.slots.right ?? [])[0], prec + 1, ctx)
    return `${a} ${String(node.properties.operator ?? '<')} ${b} ${String(node.properties.operator2 ?? '<')} ${c}`
  })
}
