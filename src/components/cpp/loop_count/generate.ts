/** `cpp:loop_count` 的 **generate** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:loop_count', (node, ctx) => {
      const varName = node.properties.var_name ?? 'i'
      const from = generateExpression((node.slots.from ?? [])[0], ctx)
      const to = generateExpression((node.slots.to ?? [])[0], ctx)
      const body = node.slots.body ?? []
      const inclusive = node.properties.inclusive === 'TRUE'
      const op = inclusive ? '<=' : '<'
      const header = `${indent(ctx)}for (int ${varName} = ${from}; ${varName} ${op} ${to}; ${varName}++)${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
