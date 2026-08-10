/** `cpp:forward_decl` 的 **generate** 路——從共用檔原封剪過來（批次第十九批：單一建立點的建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:forward_decl', (node, ctx) => {
      const returnType = node.properties.return_type ?? 'void'
      const name = node.properties.name ?? ''
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
      return `${indent(ctx)}${returnType} ${name}(${paramStr});\n`
    })
}
