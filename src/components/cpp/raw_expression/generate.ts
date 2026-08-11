/** `cpp:raw_expression` 的 **generate** 路——從共用檔原封剪過來（批次第二十九批：switch 族與原始碼容器）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:raw_expression', (node, _ctx) => {
      return String(node.properties.code ?? '')
    })
}
