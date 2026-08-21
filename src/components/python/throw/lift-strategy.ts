/**
 * `python:throw` 的 **lift** 路——`raise X(訊息)` 與 `raise X`。
 *
 * ⚠️ **兩種認不得的形狀刻意回 `null`**（走誠實降級）：
 * `raise`（單獨一行，重新丟出當前的例外）與 `raise X from Y`
 * ——這個直譯器沒有「當前的例外」也沒有例外鏈。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_throw', (node, ctx) => {
    const first = node.namedChildren[0]
    if (!first) return null // 裸的 `raise`
    if (node.namedChildren.length > 1) return null // `raise X from Y`

    if (first.type === 'identifier') {
      return createNode('python:throw', { exception: first.text }, {})
    }
    if (first.type !== 'call') return null
    const name = first.childForFieldName('function')
    if (name?.type !== 'identifier') return null
    const args = first.childForFieldName('arguments')?.namedChildren ?? []
    if (args.length > 1) return null // 積木上只有一格訊息
    const kids: Record<string, SemanticNode[]> = {}
    if (args.length === 1) {
      const v = ctx.lift(args[0])
      if (!v) return null
      kids['value'] = [v]
    }
    return createNode('python:throw', { exception: name.text }, kids)
  })
}
