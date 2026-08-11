/** `cpp:define` 的 **generate** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:define', (node, _ctx) => {
      const name = node.properties.name ?? 'MACRO'
      const value = node.properties.value ?? ''
      return `#define ${name} ${value}\n`
    })
}
