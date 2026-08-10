/** `cpp:stack_peek` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Expression concepts — return expression string (no indent, no newline)
    g.set('cpp:stack_peek', (node) => {
      const obj = node.properties.obj ?? 'stk'
      return `${obj}.top()`
    })
}
