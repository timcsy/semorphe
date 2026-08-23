/**
 * `python:type_is` 的 **lift** 路——認 `isinstance(x, int)`。
 *
 * ⚠️ **只認下拉裡的那幾個型別名**：`isinstance(x, MyClass)` 與
 * `isinstance(x, (int, str))`（一組型別）都讓一般呼叫接手
 * ——**積木上沒有那一格，而產出一個少了東西的呼叫比降級更糟**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { pythonCallArgs } from '../../../languages/python/call-args'

const TYPES = new Set(['int', 'float', 'str', 'bool', 'list', 'dict', 'tuple'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_type_is', (node, ctx) => {
    if (node.childForFieldName('function')?.text !== 'isinstance') return null
    // ⚠️ 裸的產生器算**一個**引數——見那個 helper 的檔頭
    const args = pythonCallArgs(node)
    if (args.length !== 2) return null
    if (args[1].type !== 'identifier') return null
    const want = args[1].text
    if (!TYPES.has(want)) return null
    const obj = ctx.lift(args[0])
    if (!obj) return null
    return createNode('python:type_is', { target_type: want }, { obj: [obj] })
  })
}
