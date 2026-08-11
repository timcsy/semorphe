/** `cpp:include` 的 **generate** 路——從共用檔原封剪過來（批次第三十九批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // C++ specific statements
    g.set('cpp:include', (node, _ctx) => {
      const header = node.properties.header ?? 'iostream'
      return `#include <${header}>\n`
    })
}
