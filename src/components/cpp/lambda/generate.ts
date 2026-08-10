/** `cpp:lambda` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:lambda', (node, ctx) => {
      const capture = node.properties.capture ?? '&'
      const paramChildren = node.children.params ?? []
      const body = node.children.body ?? []
      const paramStr = paramChildren.map(p => {
        const t = String(p.properties.type ?? 'int')
        const n = String(p.properties.name ?? '')
        return n ? `${t} ${n}` : t
      }).join(', ')
      const returnType = node.properties.return_type
      const retStr = returnType && returnType !== '' ? ` -> ${returnType}` : ''
      let code = `[${capture}](${paramStr})${retStr} {\n`
      code += generateBody(body, indented(ctx))
      code += `}`
      return code
    })
}
