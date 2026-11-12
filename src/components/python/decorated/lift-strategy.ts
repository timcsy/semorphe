/**
 * `python:decorated` 的 **lift** 路——`@d` 寫在 `def`／`class` 前面。
 *
 * 🔴 不可以收一半（見 `component.json` 的 `_lift_why`）：任何一格收不下就回 `null`，整段照實保留。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/** 收得下的裝飾器：名字、屬性（`@x.setter`）、一次呼叫（`@lru_cache(maxsize=None)`） */
const DECORATOR_TYPES = new Set(['identifier', 'attribute', 'call'])
/** 收得下的定義 */
const DEFINITION_TYPES = new Set(['function_definition', 'class_definition'])

/** 樹裡有沒有「看不懂而照實保留」的節點——有的話這一段就不是完整認得 */
function keepsRaw(n: SemanticNode): boolean {
  const bare = n.componentId.split(':').pop()
  if (bare === 'raw_code' || bare === 'raw_expression' || bare === 'unresolved' || n.metadata?.confidence === 'raw_code') return true
  return Object.values(n.slots ?? {}).some((cs) => (cs ?? []).some(keepsRaw))
}

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_decorated', (node, ctx) => {
    const def = node.childForFieldName('definition')
    if (!def || !DEFINITION_TYPES.has(def.type)) return null
    const decos = node.namedChildren.filter((c) => c.type === 'decorator')
    // 註解夾在裝飾器之間（`@a  # x`）：丟掉它就是丟掉使用者寫的字 → 整段照實保留
    if (decos.length === 0 || node.namedChildren.length !== decos.length + 1) return null
    const decorators: SemanticNode[] = []
    for (const d of decos) {
      const kids = d.namedChildren
      if (kids.length !== 1 || !DECORATOR_TYPES.has(kids[0].type)) return null
      const lifted = ctx.lift(kids[0])
      if (!lifted || keepsRaw(lifted)) return null
      decorators.push(lifted)
    }
    const definition = ctx.lift(def)
    if (!definition || keepsRaw(definition)) return null
    return createNode('python:decorated', {}, { decorators, definition: [definition] })
  })
}
