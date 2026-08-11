/** `cpp:operator_overload` 的 **generate** 路——從共用檔原封剪過來（批次第二十六批：OOP 方法族）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:operator_overload', (node, ctx) => {
      const returnType = node.properties.return_type ?? 'void'
      const op = node.properties.operator ?? '+'
      const paramType = node.properties.param_type ?? ''
      const paramName = node.properties.param_name ?? ''
      const body = node.children.body ?? []
      const paramStr = paramType ? (paramName ? `${paramType} ${paramName}` : paramType) : ''
      const header = `${indent(ctx)}${returnType} operator${op}(${paramStr})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
