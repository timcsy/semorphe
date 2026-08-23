/**
 * `python:container_enumerate` 的 **lift** 路——認 `enumerate(xs)` 與 `enumerate(xs, 1)`。
 *
 * ⚠️ **起點的兩種寫法都收**（位置式與 `start=`），而**記住原本是哪一種**
 * ——語義相同，換一種產回去就是改了使用者的碼。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_container_enumerate', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'enumerate') return null
    // ⚠️ 裸的產生器算**一個**引數——見那個 helper 的檔頭
    const args = pythonCallArgs(node)
    if (args.length < 1 || args.length > 2) return null
    const kids: Record<string, SemanticNode[]> = {}
    const v0 = ctx.lift(args[0])
    if (!v0) return null
    kids['value'] = [v0]

    let style = ''
    if (args.length === 2) {
      const second = args[1]
      if (second.type === 'keyword_argument') {
        // `start=10`——別的關鍵字（沒有別的）讓一般呼叫接手
        if (second.childForFieldName('name')?.text !== 'start') return null
        const v = second.childForFieldName('value')
        const lifted = v ? ctx.lift(v) : null
        if (!lifted) return null
        kids['start'] = [lifted]
        style = 'keyword'
      } else {
        const lifted = ctx.lift(second)
        if (!lifted) return null
        kids['start'] = [lifted]
        style = 'positional'
      }
    }
    return createNode('python:container_enumerate', { start_style: style }, kids)
  })
}
