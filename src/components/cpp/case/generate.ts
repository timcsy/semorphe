/** `cpp:case` 的 **generate** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:case', (node, ctx) => {
      const val = generateExpression((node.children.value ?? [])[0], ctx)
      const body = node.children.body ?? []
      let code = `${indent(ctx)}case ${val}:\n`
      code += generateBody(body, indented(ctx))
      return code
    })
}
