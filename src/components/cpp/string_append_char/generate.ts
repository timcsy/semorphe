/** `cpp:string_append_char` 的 **generate** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_append_char', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const charNodes = node.children.char ?? []
      const ch = charNodes.length > 0 ? generateExpression(charNodes[0], ctx) : "'a'"
      return `${indent(ctx)}${obj}.push_back(${ch});\n`
    })
}
