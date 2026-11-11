/**
 * `python:assign_chain` 的 **lift** 路——`a = b = 0`、`is_prime[0] = is_prime[1] = False`。
 *
 * tree-sitter 把連鎖指定剖成**右邊巢狀**的 `assignment`：
 *
 * ```
 * assignment  left: a   right: assignment  left: b   right: 0
 * ```
 *
 * 所以沿著 `right` 一路往下收 `left`，直到右邊不再是 `assignment`——那一格是值。
 *
 * 🟢 不是連鎖就回 `null`，讓同族的指派接手。
 * 🔴 任何一格不是「單一目標」（名字、索引、屬性）就整句降級（`a, b = c = …`、`a: int = …`）：
 *    收一半會產出一個少了目標的合法程式（第 410 刀的教訓）。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

const SINGLE_TARGET = new Set(['identifier', 'subscript', 'attribute'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftAssignChain', (node, ctx) => {
    if (node.childForFieldName('right')?.type !== 'assignment') return null // 不是連鎖 → 下一筆
    const lefts = []
    let cur = node
    while (cur.type === 'assignment') {
      const left = cur.childForFieldName('left')
      const right = cur.childForFieldName('right')
      if (!left || !right || cur.childForFieldName('type')) return null
      if (!SINGLE_TARGET.has(left.type)) return null
      lefts.push(left)
      cur = right
    }
    const targets: SemanticNode[] = []
    for (const l of lefts) {
      const t = ctx.lift(l)
      if (!t) return null
      targets.push(t)
    }
    const value = ctx.lift(cur)
    if (!value) return null
    return createNode('python:assign_chain', {}, { targets, value: [value] })
  })
}
