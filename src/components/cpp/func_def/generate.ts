/** `cpp:func_def` 的 **generate** 路——從共用檔原封剪過來（批次第四十二批：樹根與進入點）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:func_def', (node, ctx) => {
      const name = node.properties.name ?? 'f'
      const returnType = node.properties.return_type ?? 'void'
      const paramChildren = node.children.params ?? []
      const paramStr = paramChildren.map(p => {
        const t = String(p.properties.type ?? 'int')
        const n = String(p.properties.name ?? '')
        if (t.endsWith('[]')) {
          const baseType = t.slice(0, -2)
          return n ? `${baseType} ${n}[]` : `${baseType}[]`
        }
        return n ? `${t} ${n}` : t
      }).join(', ')
      const body = node.children.body ?? []
      const header = `${indent(ctx)}${returnType} ${name}(${paramStr})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
