/** `cpp:string_replace` 的 **generate** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_replace', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const posNodes = node.children.pos ?? []
      const lenNodes = node.children.len ?? []
      const valueNodes = node.children.value ?? []
      const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
      const len = lenNodes.length > 0 ? generateExpression(lenNodes[0], ctx) : '0'
      const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
      return `${indent(ctx)}${obj}.replace(${pos}, ${len}, ${val});\n`
    })
}
