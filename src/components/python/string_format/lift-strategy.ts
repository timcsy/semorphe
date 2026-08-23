/**
 * `python:string_format` 的 **lift** 路——認 `"…".format(…)`。
 *
 * ⚠️ **引數一律照原樣抬升**：位置式的是運算式，`n=1` 是同族的具名引數元件
 * ——兩種都插得進可增減的插槽，而內建表本來就分得出來。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_format', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'format') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args: SemanticNode[] = []
    for (const a of pythonCallArgs(node)) {
      const lifted = ctx.lift(a)
      // 一格抬不起來就整顆讓路——**不產出一個少了引數的樣板**
      if (!lifted) return null
      args.push(lifted)
    }
    return createNode('python:string_format', {}, { obj: [obj], args })
  })
}
