/** `cpp:vector_pop` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement components — return full line with indent and newline
    g.set('cpp:vector_pop', (node, ctx) => {
      const vector = node.properties.obj ?? 'vec'
      return `${indent(ctx)}${vector}.pop_back();\n`
    })
}
