/** `cpp:struct_at_ptr` 的 **generate** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:struct_at_ptr', (node, ctx) => {
      // 🔴 接收者是接點——`copy.begin()->second` 的接收者是一棵樹
      const ptr = generateExpression((node.slots.obj ?? [])[0], ctx)
      const member = node.properties.member ?? 'field'
      return `${ptr}->${member}`
    })
}
