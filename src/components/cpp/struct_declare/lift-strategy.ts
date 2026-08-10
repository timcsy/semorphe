/** `cpp:struct_declare` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { liftClassMember } from '../../../languages/cpp/core/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // struct_specifier: struct Name { members };
    registry.register('cpp:liftStructDef', (node, ctx) => {
      const nameNode = node.childForFieldName('name')
      const structName = nameNode?.text ?? 'MyStruct'
      const bodyNode = node.childForFieldName('body')
      const members: SemanticNode[] = []

      if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
          if (child.type === 'access_specifier') continue
          const lifted = liftClassMember(child, structName, ctx)
          if (lifted) members.push(lifted)
        }
      }

      return createNode('cpp:struct_declare', { name: structName }, { members })
    })
}
