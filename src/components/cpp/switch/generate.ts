/** `cpp:switch` 的 **generate** 路——從共用檔原封剪過來（批次第二十九批：switch 族與原始碼容器）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:switch', (node, ctx) => {
      const expr = generateExpression((node.children.expr ?? [])[0], ctx)
      const cases = node.children.cases ?? []
      const header = `${indent(ctx)}switch (${expr})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(cases, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
