/** `cpp:enum` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftEnum', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // enum_specifier: enum Color { RED, GREEN, BLUE };
    registry.register('cpp:liftEnum', (node) => {
      const nameNode = node.namedChildren.find(c => c.type === 'type_identifier')
      const listNode = node.namedChildren.find(c => c.type === 'enumerator_list')
      // 匿名的列舉（`enum { A, B };`）name 為空——不再編 `MyEnum`（2026-11-08：多一個學生沒寫的型別名）
      const name = nameNode?.text ?? ''
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

/**
 * `typedef enum [Tag] { … } Alias;`：typedef 那顆的 lift 把帶本體的列舉交給上面的策略，再呼叫這個記別名（同結構那顆的 asTypedefStruct）。
 * 不是列舉的回 null。
 */
export function asTypedefEnum(lifted: SemanticNode | null, alias: string): SemanticNode | null {
  if (!lifted || lifted.componentId !== 'cpp:enum') return null
  return { ...lifted, properties: { ...lifted.properties, typedef_alias: alias } }
}
