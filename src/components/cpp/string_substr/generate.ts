/** `cpp:string_substr` 的 **generate** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_substr', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const posNodes = node.children.pos ?? []
      const lenNodes = node.children.len ?? []
      const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
      const len = lenNodes.length > 0 ? generateExpression(lenNodes[0], ctx) : ''
      return len ? `${obj}.substr(${pos}, ${len})` : `${obj}.substr(${pos})`
    })
}
