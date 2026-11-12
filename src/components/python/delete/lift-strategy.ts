/**
 * `python:delete` 的 **lift** 路——`del x`、`del o.attr`、`del a, xs[0]`。
 *
 * ⚠️ 單一的 `del d[k]` **不歸這裡**（同族的「刪掉容器的一格」先收，見 `component.json` 的 `_lift_why`）。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

/** 收得下的目標：名字、屬性、某一格——都是左值 */
const TARGET_TYPES = new Set(['identifier', 'attribute', 'subscript'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_delete', (node, ctx) => {
    const kids = node.namedChildren
    if (kids.length !== 1) return null
    // `del a, b` 的目標包在一個 `expression_list` 裡
    const targets = kids[0].type === 'expression_list' ? kids[0].namedChildren : [kids[0]]
    if (targets.length === 0) return null
    if (!targets.every((t) => TARGET_TYPES.has(t.type))) return null // `del (a)`、`del [a, b]`
    if (targets.length === 1 && targets[0].type === 'subscript') return null // 同族那一顆的
    const lifted = targets.map((t) => ctx.lift(t))
    // 有一格認不出來 → 整句降級，不產出一個少了目標的 del
    if (lifted.some((x) => !x)) return null
    return createNode('python:delete', {}, { targets: lifted as NonNullable<(typeof lifted)[number]>[] })
  })
}
