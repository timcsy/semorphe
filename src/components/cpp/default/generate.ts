/** `cpp:default` 的 **generate** 路——從共用檔原封剪過來（批次第二十九批：switch 族與原始碼容器）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:default', (node, ctx) => {
      const body = node.children.body ?? []
      let code = `${indent(ctx)}default:\n`
      code += generateBody(body, indented(ctx))
      return code
    })
}
