/** `cpp:typedef` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftTypedef', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // type_definition: typedef int myint; → cpp_typedef
    registry.register('cpp:liftTypedef', (node) => {
      const typeNode = node.namedChildren.find(c =>
        c.type === 'primitive_type' || c.type === 'type_identifier' ||
        c.type === 'qualified_identifier' || c.type === 'sized_type_specifier'
      )
      const aliasNode = node.namedChildren.find(c => c.type === 'type_identifier' &&
        (c.startPosition.row !== typeNode?.startPosition.row || c.startPosition.column !== typeNode?.startPosition.column)
      )
      const origType = typeNode?.text ?? 'int'
      const alias = aliasNode?.text ?? 'mytype'
      return createNode('cpp:typedef', { orig_type: origType, alias })
    })
}
