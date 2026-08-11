/** `cpp:using_namespace` 的 **generate** 路——從共用檔原封剪過來（批次第三十一批：兩顆鷹架）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:using_namespace', (node, ctx) => {
      const ns = node.properties.ns ?? 'std'
      return `${indent(ctx)}using namespace ${ns};\n`
    })
}
