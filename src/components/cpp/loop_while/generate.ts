/** `cpp:loop_while` 的 **generate** 路——從共用檔原封剪過來（批次第十二批：lift 是一整筆 pattern）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:loop_while', (node, ctx) => {
      const cond = generateExpression((node.children.condition ?? [])[0], ctx)
      const body = node.children.body ?? []
      const header = `${indent(ctx)}while (${cond})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
