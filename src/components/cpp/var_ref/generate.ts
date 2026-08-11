/** `cpp:var_ref` 的 **generate** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_ref', (node, _ctx) => {
      return String(node.properties.name ?? '')
    })
}
