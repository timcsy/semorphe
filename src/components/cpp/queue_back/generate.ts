/** `cpp:queue_back` 的 **generate** 路——從 `std/queue/generators.ts` 原封搬過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:queue_back', (node) => {
    const obj = node.properties.obj ?? 'q'
    return `${obj}.back()`
  })
}
