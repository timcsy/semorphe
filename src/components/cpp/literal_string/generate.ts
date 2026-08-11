/** `cpp:literal_string` 的 **generate** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:literal_string', (node, _ctx) => {
      return `"${node.properties.value ?? ''}"`
    })
}
