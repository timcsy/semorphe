/** `cpp:new` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftNewExpression', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftNewExpression', (node) => {
      const typeNode = node.namedChildren.find(c =>
        c.type === 'type_identifier' || c.type === 'primitive_type' || c.type === 'sized_type_specifier'
      )
      const type = typeNode?.text ?? 'int'
      const argList = node.namedChildren.find(c => c.type === 'argument_list')
      const args = argList ? argList.namedChildren.map(a => a.text).join(', ') : ''
      return createNode('cpp:new', { type, args })
    })
}
