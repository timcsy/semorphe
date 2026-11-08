/** `cpp:sizeof` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftSizeof', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // sizeof_expression: sizeof(int) or sizeof(x)
    registry.register('cpp:liftSizeof', (node) => {
      const child = node.namedChildren[0]
      if (child) {
        if (child.type === 'type_descriptor') {
          return createNode('cpp:sizeof', { target: child.text })
        }
        if (child.type === 'parenthesized_expression') {
          return createNode('cpp:sizeof', { target: child.namedChildren[0]?.text ?? child.text })
        }
        return createNode('cpp:sizeof', { target: child.text })
      }
      return createNode('cpp:sizeof', { target: 'int' })
    })
}

/** `sizeof(T)` 的 T（目標是型別名時；不是 sizeof 就回 null）——判斷不了是型別還是變數，交給呼叫端比對。 */
export function sizeofTypeTarget(n: SemanticNode | undefined): string | null {
  return n?.componentId === 'cpp:sizeof' && typeof n.properties.target === 'string' ? n.properties.target.trim() : null
}

/** `sizeof(T)`（T 是型別）——C++ → C 把單一的 `new T` 換成 `malloc(sizeof(T))` 時用（357）。 */
export function buildSizeofType(t: string): SemanticNode {
  return createNode('cpp:sizeof', { target: t })
}
