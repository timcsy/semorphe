/** `python:arithmetic` 的 **generate** 路——中綴，靠優先級決定要不要括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:arithmetic', (node, ctx) => {
    const op = String(node.properties.operator ?? '+')
    const prec = precedence(node)
    // 右邊用 prec + 1：同優先級時右邊要括號（`a - (b - c)`），左邊不用（左結合）。
    const left = genChild((node.children.left ?? [])[0], prec, ctx)
    const right = genChild((node.children.right ?? [])[0], prec + 1, ctx)
    return `${left} ${op} ${right}`
  })
}
