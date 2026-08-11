/** `cpp:container_pop` 的 **generate** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_pop', (node, ctx) => {
      const obj = node.properties.obj ?? 'obj'
      return `${indent(ctx)}${obj}.pop();\n`
    })
}
