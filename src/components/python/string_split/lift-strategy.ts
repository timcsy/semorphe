/** `python:string_split` 的 **lift** 路——認 `x.split(...)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_string_split', (node, ctx) => {
    const fn = node.childForFieldName('function')
    if (fn?.type !== 'attribute') return null
    if (fn.childForFieldName('attribute')?.text !== 'split') return null
    const objNode = fn.childForFieldName('object')
    const obj = objNode ? ctx.lift(objNode) : null
    if (!obj) return null
    const args = node.childForFieldName('arguments')?.namedChildren ?? []
    // 🟢 **不帶引數的也收**（2026-08-22）：`"3 1 4".split()`（用空白切）
    //    是讀一行拆數字時最常見的寫法，而它之前掉進通用桶。
    if (args.length > 1) return null // 引數更多 → 讓一般方法呼叫接手
    if (args.length === 0) return createNode('python:string_split', {}, { obj: [obj] })
    const value = ctx.lift(args[0]); if (!value) return null
    return createNode('python:string_split', {}, { obj: [obj], value: [value] })
  })
}
