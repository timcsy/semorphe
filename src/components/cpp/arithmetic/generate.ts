/** `cpp:arithmetic` 的 **generate** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../languages/cpp/core/generators/expressions'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:arithmetic', (node, ctx) => {
      const op = node.properties.operator ?? '+'
      const prec = precedence(node)
      const leftNode = (node.children.left ?? [])[0]
      const rightNode = (node.children.right ?? [])[0]
      const left = genChild(leftNode, prec, ctx)
      // Right child: use prec+1 to force parens for same-precedence on right side
      // e.g. a - (b - c) needs parens, but a - b + c doesn't (left-to-right)
      const right = genChild(rightNode, prec + 1, ctx)
      return `${left} ${op} ${right}`
    })
}
