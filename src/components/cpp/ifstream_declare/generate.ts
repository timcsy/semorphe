/** `cpp:ifstream_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十六批：型別名資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:ifstream_declare', (node, ctx) => {
      const name = (node.properties.name as string) ?? 'fin'
      // Support both property-based (from block) and children-based (from lifter) init
      const initNodes = node.children.initializer ?? []
      if (initNodes.length > 0) {
        const val = generateExpression(initNodes[0], ctx)
        return `${indent(ctx)}ifstream ${name}(${val});\n`
      }
      const file = (node.properties.file as string) ?? 'input.txt'
      return `${indent(ctx)}ifstream ${name}("${file}");\n`
    })
}
