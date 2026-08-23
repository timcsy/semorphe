/**
 * `python:string_fill` 的 **lift** 路——`zfill`／`ljust`／`rjust` 三個名字一顆元件。
 *
 * ⚠️ **`zfill` 只吃一個引數**：兩個的話讓一般方法呼叫接手
 * ——那在真的 Python 裡本來就會出錯，而我們不該把它變成一個看起來合法的積木。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'
import type { SemanticNode } from '../../../core/types'

const METHODS = new Set(['zfill', 'ljust', 'rjust'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_fill', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    const method = fn.childForFieldName('attribute')?.text ?? ''
    if (!METHODS.has(method)) return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = pythonCallArgs(node)
    if (args.length < 1 || args.length > 2) return null
    if (method === 'zfill' && args.length !== 1) return null
    const width = ctx.lift(args[0])
    if (!width) return null
    const kids: Record<string, SemanticNode[]> = { obj: [obj], width: [width] }
    if (args.length === 2) {
      const fill = ctx.lift(args[1])
      if (!fill) return null
      kids['fill'] = [fill]
    }
    return createNode('python:string_fill', { method }, kids)
  })
}
