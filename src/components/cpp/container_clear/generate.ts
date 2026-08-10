/** `cpp:container_clear` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_clear', (node, ctx) => {
      const obj = node.properties.obj ?? 'obj'
      return `${indent(ctx)}${obj}.clear();\n`
    })
}
