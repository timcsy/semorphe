/** `cpp:method_virtual` 的 **generate** 路——從共用檔原封剪過來（批次第二十六批：OOP 方法族）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'
import { formatParams } from '../../../languages/cpp/core/generators/statements'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:method_virtual', (node, ctx) => {
      const returnType = node.properties.return_type ?? 'void'
      const name = node.properties.name ?? 'method'
      const paramChildren = node.children.params ?? []
      const body = node.children.body ?? []
      const paramStr = formatParams(paramChildren)
      const header = `${indent(ctx)}virtual ${returnType} ${name}(${paramStr})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
