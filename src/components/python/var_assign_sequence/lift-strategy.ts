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

/**
 * 樣式裡的每一個葉子都是【左值】（第 421 刀）：名字、索引（`a[i]`）、屬性（`o.x`），
 * 以及由它們組成的元組與展開（`*mid`）。切片（`a[1:3]`）不收——Cella 的切片指定還在路上，收了也只會是 unknown。
 */
function isLvaluePattern(n: SemanticNode): boolean {
  const id = n.componentId.split(':')[1]
  if (id === 'var_ref' || id === 'container_at' || id === 'member_at') return true
  if (id === 'splat') return n.properties.kind === 'list' && (n.slots.value ?? []).length === 1 && isLvaluePattern(n.slots.value[0])
  if (id === 'tuple_make') return (n.slots.items ?? []).length > 0 && (n.slots.items ?? []).every(isLvaluePattern)
  return false
}

// ⚠️ `param_decl` 是**核心的共用結構節點**（同族函式定義的參數也用它），
//    不是某一顆膠囊的身分——所以這裡直接建，沒有跨膠囊的外洩。

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftSequenceAssign', (node, ctx) => {
    const left = node.childForFieldName('left')
    if (!left || (left.type !== 'pattern_list' && left.type !== 'tuple_pattern')) return null // 單一指派 → 讓下一筆樣式接手
    const right = node.childForFieldName('right')
    // 🔴 連鎖指定（`a, b = c, d = …`）與巢狀／非名字的目標（`a, (b, c) = …`、`x[0], x[1] = …`）都不收（第 410 刀）：
    //    以前只挑出名字、其餘安靜丟掉，產回去是一個少了目標的合法程式。收不下就整句降級。
    if (right?.type === 'assignment') return null
    const value = right ? ctx.lift(right) : null

    if (left.type === 'pattern_list' && left.namedChildren.length > 1 && left.namedChildren.every((c) => c.type === 'identifier')) {
      const targets: SemanticNode[] = left.namedChildren
        .map((c) => createNode('param_decl', { type: '', name: c.text }))
      return createNode('python:var_assign_sequence', {}, { targets, value: value ? [value] : [] })
    }
    // 🟢 **目標是一個樣式**（第 421 刀，與 420 的 `for` 同一個做法）：`a[i], a[j] = a[j], a[i]`、`first, *mid, last = r`、
    //    `a, (b, c) = …`、`o.x, o.y = …`。🪦 410–420 整句誠實降級。樣式收成運算式，住在 `pattern` 接點，積木換一個形態。
    const pattern = ctx.lift(left)
    if (!pattern || !isLvaluePattern(pattern)) return null
    return createNode('python:var_assign_sequence', {}, { targets: [], pattern: [pattern], value: value ? [value] : [] })
  })
}
