/**
 * `python:cast` 的 **lift** 路——認 `int(x)`／`str(x)`／`float(x)`／`bool(x)`。
 *
 * 🟢 不是那四個名字就回 `null`，比對迴圈落到下一筆樣式。
 *
 * ⚠️ **只認一個引數的**：`int("ff", 16)` 有第二個引數（進位），
 * 而這顆積木上沒有那一格——讓一般呼叫接手才不會**產出一個少了引數的呼叫**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

const TARGETS = new Set(['int', 'str', 'float', 'bool'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_cast', (node, ctx) => {
    const name = node.childForFieldName('function')?.text ?? ''
    if (!TARGETS.has(name)) return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    if (args.length !== 1) return null
    const value = ctx.lift(args[0])
    // 引數認不出來 → 整顆降級，不產出一個空著的轉換
    if (!value) return null
    return createNode('python:cast', { target_type: name }, { value: [value] })
  })
}
