/** `cpp:sizeof` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftSizeof', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // sizeof_expression：`sizeof(int)`（type_descriptor）、`sizeof(x)`／`sizeof x`（一個名字）、`sizeof a.bytes`（運算式）
  registry.register('cpp:liftSizeof', (node, ctx) => {
    const child = node.namedChildren[0]
    if (!child) return createNode('cpp:sizeof', { target: 'int' })
    if (child.type === 'type_descriptor') return createNode('cpp:sizeof', { target: child.text })
    const inner = child.type === 'parenthesized_expression' ? (child.namedChildren[0] ?? child) : child
    // 單一個名字：語法分不出是型別（typedef、struct 名）還是變數 ⟹ 留在文字，formalize 查宣告
    if (inner.type === 'identifier' || inner.type === 'type_identifier') return createNode('cpp:sizeof', { target: inner.text })
    // 運算式（成員、下標、算式、解參照）：升格成接點，不壓成一串文字（355）；積木形態由接點有沒有東西挑
    const expr = ctx.lift(inner)
    if (!expr) return createNode('cpp:sizeof', { target: inner.text })
    return createNode('cpp:sizeof', {}, { expr: [expr] })
  })
}

/** `sizeof(T)` 的 T（目標是型別名時；不是 sizeof 就回 null）——判斷不了是型別還是變數，交給呼叫端比對。 */
export function sizeofTypeTarget(n: SemanticNode | undefined): string | null {
  return n?.componentId === 'cpp:sizeof' && typeof n.properties.target === 'string' ? n.properties.target.trim() : null
}
