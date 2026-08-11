/** `cpp:istringstream_declare` 的 **generate** 路——從共用檔原封剪過來（批次第二十五批：單一建立點 → 建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:istringstream_declare', (node, ctx) => {
      const name = node.properties.name ?? 'in'
      const src = node.children.source ?? []
      const arg = src.length > 0 ? generateExpression(src[0], ctx) : ''
      return `${indent(ctx)}istringstream ${name}(${arg});\n`
    })
}
