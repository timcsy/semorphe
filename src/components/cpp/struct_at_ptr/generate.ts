/** `cpp:struct_at_ptr` 的 **generate** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:struct_at_ptr', (node) => {
      const ptr = node.properties.obj ?? 'ptr'
      const member = node.properties.member ?? 'field'
      return `${ptr}->${member}`
    })
}
