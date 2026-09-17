/** `cpp:method_call` 的 **generate** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:method_call', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
      const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
      const method = node.properties.method ?? 'method'
      const args = (node.slots.args ?? []).map(a => generateExpression(a, ctx))
      const expr = `${obj}.${method}(${args.join(', ')})`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    })
}
