/** `cpp:lambda` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateBody, indented, indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:lambda', (node, ctx) => {
      const capture = node.properties.capture ?? '&'
      const paramChildren = node.slots.params ?? []
      const body = node.slots.body ?? []
      const paramStr = paramChildren.map(p => {
        const t = String(p.properties.type ?? 'int')
        const n = String(p.properties.name ?? '')
        return n ? `${t} ${n}` : t
      }).join(', ')
      const returnType = node.properties.return_type
      const retStr = returnType && returnType !== '' ? ` -> ${returnType}` : ''
      let code = `[${capture}](${paramStr})${retStr} {\n`
      code += generateBody(body, indented(ctx))
      // ⚠️ 收尾的大括號要對齊**這顆 lambda 所在的那一層**——原本是第 0 欄。
      code += `${indent(ctx)}}`
      return code
    })
}
