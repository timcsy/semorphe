/** `cpp:include_local` 的 **generate** 路——從共用檔原封剪過來（批次第三十一批：兩顆鷹架）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:include_local', (node, _ctx) => {
      const header = node.properties.header ?? 'myheader.h'
      return `#include "${header}"\n`
    })
}
