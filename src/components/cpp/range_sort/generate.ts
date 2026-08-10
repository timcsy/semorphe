/** `cpp:range_sort` 的 **generate** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_sort', (node, ctx) => {
      const begin = node.properties.begin ?? 'v.begin()'
      const end = node.properties.end ?? 'v.end()'
      return `${indent(ctx)}sort(${begin}, ${end});\n`
    })
}
