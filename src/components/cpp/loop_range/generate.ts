/** `cpp:loop_range` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:loop_range', (node, ctx) => {
      const varType = node.properties.var_type ?? 'auto'
      const varName = node.properties.var_name ?? 'x'
      const container = node.properties.container ?? 'vec'
      const bodyNodes = node.children.body ?? []
      const bodyCode = generateBody(bodyNodes, indented(ctx))
      const ind = indent(ctx)
      return `${ind}for (${varType} ${varName} : ${container}) {\n${bodyCode}${ind}}\n`
    })
}
