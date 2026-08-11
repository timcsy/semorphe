/** `cpp:logic` 的 **generate** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../languages/cpp/core/generators/expressions'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:logic', (node, ctx) => {
      const prec = precedence(node)
      const left = genChild((node.children.left ?? [])[0], prec, ctx)
      const right = genChild((node.children.right ?? [])[0], prec + 1, ctx)
      const op = node.properties.operator ?? '&&'
      return `${left} ${op} ${right}`
    })
}
