/** `cpp:array_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十八批：四個重複建立點收成一個建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_declare', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'arr'
      const sizeNodes = node.children.size ?? []
      const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : (node.properties.size ?? '10')
      // 初始值三態：欄位不存在 → 無初始化；[] → `= {}`；有內容 → `= {…}`
      const values = node.children.values
      const init = values === undefined ? '' : ` = {${values.map(v => generateExpression(v, ctx)).join(', ')}}`
      return `${indent(ctx)}${type} ${name}[${size}]${init};\n`
    })
}
