/** `cpp:raw_code` 的 **generate** 路——從共用檔原封剪過來（批次第二十九批：switch 族與原始碼容器）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:raw_code', (node, ctx) => {
      const code = String(node.properties.code ?? '')
      return `${indent(ctx)}${code}\n`
    })
}
