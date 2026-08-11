/** `cpp:builtin_constant` 的 **generate** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:builtin_constant', (node, _ctx) => {
      return String(node.properties.value ?? 'NULL')
    })
}
