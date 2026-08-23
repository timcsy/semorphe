/**
 * `python:method_call` 的 **lift** 路。
 *
 * ```
 * call [function,arguments]  «parts[0].upper()»
 *   attribute [object,attribute]   ← function：物件 ＋ 方法名
 *     subscript                      ← object：**一整個運算式**
 *     identifier «upper»             ← attribute：方法名
 *   argument_list
 * ```
 *
 * 🟢 `function` 不是 `attribute` 的（一般函式呼叫）回 `null`，讓下一筆樣式接手。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftMethodCall', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null

    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null

    const args: SemanticNode[] = []
    for (const a of pythonCallArgs(node)) {
      const lifted = ctx.lift(a)
      if (!lifted) return null // 有一個引數認不出來 → 整顆降級，不產出少了引數的呼叫
      args.push(lifted)
    }

    return createNode(
      'python:method_call',
      { method: fn.childForFieldName('attribute')?.text ?? '' },
      { obj: [obj], args },
    )
  })
}
