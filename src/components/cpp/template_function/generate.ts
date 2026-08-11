/** `cpp:template_function` 的 **generate** 路——從共用檔原封剪過來（批次第二十五批：單一建立點 → 建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:template_function', (node, ctx) => {
      const t = node.properties.t ?? 'T'
      const returnType = node.properties.return_type ?? 'T'
      const funcName = node.properties.func_name ?? 'myFunc'
      const paramChildren = node.children.params ?? []
      const paramStr = paramChildren.map(p => {
        const pt = String(p.properties.type ?? 'T')
        const pn = String(p.properties.name ?? '')
        if (pt.endsWith('[]')) {
          const baseType = pt.slice(0, -2)
          return pn ? `${baseType} ${pn}[]` : `${baseType}[]`
        }
        return pn ? `${pt} ${pn}` : pt
      }).join(', ')
      const bodyNodes = node.children.body ?? []
      const bodyCode = generateBody(bodyNodes, indented(ctx))
      const ind = indent(ctx)
      return `${ind}template <typename ${t}>\n${ind}${returnType} ${funcName}(${paramStr}) {\n${bodyCode}${ind}}\n`
    })
}
