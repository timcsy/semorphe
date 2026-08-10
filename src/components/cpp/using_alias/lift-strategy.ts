/** `cpp:using_alias` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftAliasDeclaration', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // alias_declaration: using ll = long long; → cpp_using_alias
    registry.register('cpp:liftAliasDeclaration', (node) => {
      const nameNode = node.namedChildren.find(c => c.type === 'type_identifier')
      const descriptorNode = node.namedChildren.find(c => c.type === 'type_descriptor')
      const alias = nameNode?.text ?? 'mytype'
      const origType = descriptorNode?.text ?? 'int'
      return createNode('cpp:using_alias', { alias, orig_type: origType })
    })
}
