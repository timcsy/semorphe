/** `cpp:struct_declare` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { liftClassMember } from '../../../languages/cpp/lang/lifters/strategies'
import { parseBaseClause } from '../../../languages/cpp/base-clause'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // struct_specifier: struct Name { members };
    registry.register('cpp:liftStructDef', (node, ctx) => {
      const nameNode = node.childForFieldName('name')
      const structName = nameNode?.text ?? 'MyStruct'
      const bodyNode = node.childForFieldName('body')
      // 基底（spec 209）：多重／virtual 繼承這顆裝不下 ⟹ 讓開，照實降級（不留半套）
      const base = parseBaseClause(node)
      if (base === 'unsupported') return null
      const members: SemanticNode[] = []

      if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
          if (child.type === 'access_specifier') continue
          const lifted = liftClassMember(child, structName, ctx)
          if (lifted) members.push(lifted)
        }
      }

      const props: Record<string, string> = { name: structName }
      if (base) { props.base_class = base.base; props.base_access = base.access }
      return createNode('cpp:struct_declare', props, { members })
    })
}
