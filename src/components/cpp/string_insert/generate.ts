/** `cpp:string_insert` 的 **generate** 路——從共用檔原封剪過來（批次第八批：io.ts 的帶判別分支（括號形式／方法引數個數消歧））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_insert', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const posNodes = node.children.pos ?? []
      const valueNodes = node.children.value ?? []
      const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
      const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
      return `${indent(ctx)}${obj}.insert(${pos}, ${val});\n`
    })
}
