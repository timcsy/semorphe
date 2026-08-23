/** `python:string_split` 的 **lift** 路——認 `x.split(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ **裸的產生器算一個引數**——`" ".join(f(x) for x in xs)` 的 `arguments`
//    【就是】那個產生器節點，照 `namedChildren` 數會數到兩個（見那個 helper 的檔頭）
import { pythonCallArgs } from '../../../languages/python/call-args'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_split', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'split') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = pythonCallArgs(node)
    // 🟢 **不帶引數的也收**（2026-08-22）：`"3 1 4".split()`（用空白切）
    //    是讀一行拆數字時最常見的寫法，而它之前掉進通用桶。
    if (args.length > 1) return null // 引數更多 → 讓一般方法呼叫接手
    if (args.length === 0) return createNode('python:string_split', {}, { obj: [obj] })
    const value = ctx.lift(args[0]); if (!value) return null
    return createNode('python:string_split', {}, { obj: [obj], value: [value] })
  })
}
