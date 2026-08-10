/** `cpp:set_insert` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:set_insert', (node, ctx) => {
      const obj = node.properties.obj ?? 's'
      const valueNodes = node.children.value ?? []
      const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
      return `${indent(ctx)}${obj}.insert(${val});\n`
    })
}
