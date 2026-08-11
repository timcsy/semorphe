/** `cpp:cstring_find` 的 **generate** 路——從共用檔原封剪過來（批次第二十八批：cctype／cstring 剩餘）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cstring_find', (node, ctx) => {
      const haystack = generateExpression((node.children.haystack ?? [])[0], ctx)
      const needle = generateExpression((node.children.needle ?? [])[0], ctx)
      return `strstr(${haystack}, ${needle})`
    })
}
