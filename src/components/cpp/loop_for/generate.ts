/** `cpp:loop_for` 的 **generate** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:loop_for', (node, ctx) => {
      const strip = (s: string) => s.replace(/;\s*$/, '').trim()
      const initExpr = strip(generateExpression((node.children.init ?? [])[0], ctx))
      const condExpr = strip(generateExpression((node.children.cond ?? [])[0], ctx))
      const updateExpr = strip(generateExpression((node.children.update ?? [])[0], ctx))
      const body = node.children.body ?? []
      const header = `${indent(ctx)}for (${initExpr}; ${condExpr}; ${updateExpr})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
