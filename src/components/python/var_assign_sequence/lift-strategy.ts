/**
 * `python:var_assign_sequence` 的 **lift** 路。
 *
 * `x, y = p` 的左邊是 `pattern_list`；`x = p` 的左邊是 `identifier`。
 * **同一個 `assignment` 節點型別**，所以判別要跑真邏輯。
 *
 * 🟢 不是序列指派就回 `null`——比對迴圈落到下一筆，由同族的單一指派接手。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

// ⚠️ `param_decl` 是**核心的共用結構節點**（同族函式定義的參數也用它），
//    不是某一顆膠囊的身分——所以這裡直接建，沒有跨膠囊的外洩。

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftSequenceAssign', (node, ctx) => {
    const left = node.childForFieldName('left')
    if (!left || left.type !== 'pattern_list') return null // 單一指派 → 讓下一筆樣式接手

    const targets: SemanticNode[] = left.namedChildren
      .filter((c) => c.type === 'identifier')
      .map((c) => createNode('param_decl', { type: '', name: c.text }))
    if (targets.length === 0) return null

    const right = node.childForFieldName('right')
    const value = right ? ctx.lift(right) : null
    return createNode('python:var_assign_sequence', {}, { targets, value: value ? [value] : [] })
  })
}
