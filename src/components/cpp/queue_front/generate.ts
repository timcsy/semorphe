/** `cpp:queue_front` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Expression concepts
    g.set('cpp:queue_front', (node) => {
      const obj = node.properties.obj ?? 'q'
      return `${obj}.front()`
    })
}
