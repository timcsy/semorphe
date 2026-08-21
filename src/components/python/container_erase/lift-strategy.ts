/**
 * `python:container_erase` 的 **lift** 路——`del d["a"]`／`del xs[0]`。
 *
 * ⚠️ **只收「容器的某一格」**。`del x`（刪掉一個變數）回 `null` 走誠實降級：
 * 這個直譯器沒有「讓一個名字消失」這件事，而**假裝刪掉了**比看得見的灰色方塊糟。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_erase', (node, ctx) => {
    const kids = node.namedChildren
    if (kids.length !== 1) return null // `del a, b` 一次刪多個
    if (kids[0].type !== 'subscript') return null // `del x`
    const target = ctx.lift(kids[0])
    if (!target) return null
    return createNode('python:container_erase', {}, { target: [target] })
  })
}
