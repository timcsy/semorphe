/** `cpp:string_find` 的 **generate** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_find', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const argNodes = node.children.arg ?? []
      const arg = argNodes.length > 0 ? generateExpression(argNodes[0], ctx) : '""'
      return `${obj}.find(${arg})`
    })
}
