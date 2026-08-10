/** `cpp:enum` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftEnum', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // enum_specifier: enum Color { RED, GREEN, BLUE };
    registry.register('cpp:liftEnum', (node) => {
      const nameNode = node.namedChildren.find(c => c.type === 'type_identifier')
      const listNode = node.namedChildren.find(c => c.type === 'enumerator_list')
      const name = nameNode?.text ?? 'MyEnum'
      const values = listNode
        ? listNode.namedChildren
            .filter(c => c.type === 'enumerator')
            .map(e => {
              const eName = e.childForFieldName('name')?.text ?? ''
              const eValue = e.childForFieldName('value')?.text
              return eValue ? `${eName} = ${eValue}` : eName
            })
            .join(', ')
        : ''
      return createNode('cpp:enum', { name, values })
    })
}
