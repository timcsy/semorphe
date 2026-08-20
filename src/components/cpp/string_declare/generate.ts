/** `cpp:string_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十六批：型別名資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement components — return full line with indent and newline
    g.set('cpp:string_declare', (node, ctx) => {
      const name = node.properties.name ?? 'str'
      const initNodes = node.children.initializer ?? []
      if (initNodes.length > 0) {
        const val = generateExpression(initNodes[0], ctx)
        return `${indent(ctx)}string ${name} = ${val};\n`
      }
      return `${indent(ctx)}string ${name};\n`
    })
}
