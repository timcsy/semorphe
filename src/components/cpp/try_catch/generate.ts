/** `cpp:try_catch` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:try_catch', (node, ctx) => {
      const tryBody = node.children.try_body ?? []
      const catchType = node.properties.catch_type ?? 'exception&'
      const catchName = node.properties.catch_name ?? 'e'
      const catchBody = node.children.catch_body ?? []
      const header = `${indent(ctx)}try${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(tryBody, indented(ctx))
      const catchHeader = `${indent(ctx)}}${style.brace_style === 'Allman' ? '\n' + indent(ctx) : ' '}catch (${catchType} ${catchName})${openBrace(ctx)}\n`
      trackOwnText(ctx, catchHeader)
      code += catchHeader
      code += generateBody(catchBody, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
