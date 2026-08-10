/** `cpp:priority_queue_peek` 的 **generate** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:priority_queue_peek', (node) => {
      const obj = node.properties.obj ?? 'pq'
      return `${obj}.top()`
    })
}
