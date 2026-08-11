/** `cpp:cstring_find_char` 的 **generate** 路——從共用檔原封剪過來（批次第二十八批：cctype／cstring 剩餘）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cstring_find_char', (node, ctx) => {
      const str = generateExpression((node.children.str ?? [])[0], ctx)
      const ch = generateExpression((node.children.ch ?? [])[0], ctx)
      return `strchr(${str}, ${ch})`
    })
}
