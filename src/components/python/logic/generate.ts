/** `python:logic` 的 **generate** 路——中綴，靠優先級決定要不要括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:logic', (node, ctx) => {
    const op = String(node.properties.operator ?? 'and')
    const prec = precedence(node)
    const left = genChild((node.children.left ?? [])[0], prec, ctx)
    const right = genChild((node.children.right ?? [])[0], prec + 1, ctx)
    return `${left} ${op} ${right}`
  })
}
