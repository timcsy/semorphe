/** `cpp:method_call` 的 **generate** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:method_call', (node, ctx) => {
      const obj = node.properties.obj ?? 'obj'
      const method = node.properties.method ?? 'method'
      const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
      const expr = `${obj}.${method}(${args.join(', ')})`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    })
}
