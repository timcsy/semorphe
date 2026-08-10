/** `cpp:map_assign` 的 **generate** 路——從共用檔原封剪過來（批次第十批：assignment_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:map_assign', (node, ctx) => {
      const obj = node.properties.obj ?? 'mp'
      const keyNodes = node.children.key ?? []
      const valueNodes = node.children.value ?? []
      const key = keyNodes.length > 0 ? generateExpression(keyNodes[0], ctx) : '0'
      const value = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
      return `${indent(ctx)}${obj}[${key}] = ${value};\n`
    })
}
