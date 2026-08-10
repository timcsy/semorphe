/** `cpp:namespace_def` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftNamespace', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // namespace_definition: namespace N { body }
    registry.register('cpp:liftNamespace', (node, ctx) => {
      const nameNode = node.namedChildren.find(c => c.type === 'namespace_identifier')
      const name = nameNode?.text ?? 'ns'
      const bodyNode = node.namedChildren.find(c => c.type === 'declaration_list')
      const body: SemanticNode[] = []
      if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
          const lifted = ctx.lift(child)
          if (lifted) body.push(lifted)
        }
      }
      return createNode('cpp:namespace_def', { name }, { body })
    })
}
