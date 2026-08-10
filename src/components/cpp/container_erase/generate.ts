/** `cpp:container_erase` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_erase', (node, ctx) => {
      const obj = node.properties.obj ?? 'obj'
      const key = generateExpression((node.children.key ?? [])[0], ctx)
      return `${indent(ctx)}${obj}.erase(${key});\n`
    })
}
