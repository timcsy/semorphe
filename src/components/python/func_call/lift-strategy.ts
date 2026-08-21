/**
 * `python:func_call` 的 **lift** 路（其中一種形狀）——**引數就是一個產生器運算式**。
 *
 * ```
 * all(x > 0 for x in xs)
 *     └────────────────┘  ← tree-sitter 把它當成 `arguments` 本身，
 *                            **沒有 `argument_list` 包著**
 * ```
 *
 * 🔴 而一般那一筆樣式用 `liftChildren` 攤開 `arguments` 的子節點，於是它攤開的是
 * **產生器的內部**（本體與 `for` 子句各一個）——產出 `all(x, for x in xs)`：
 * 一個多了逗號的、不合法的呼叫。
 *
 * > **一個「攤開這個欄位的子節點」的宣告，假設了那個欄位一定是一個清單。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_call_generator', (node, ctx) => {
    const fn = node.childForFieldName('function')
    // ⚠️ `obj.method(x for x in xs)` 的接收者要走方法呼叫那顆——這裡只收裸名字
    if (fn?.type !== 'identifier') return null
    const gen = node.childForFieldName('arguments')
    const lifted = gen ? ctx.lift(gen) : null
    if (!lifted) return null
    return createNode('python:func_call', { name: fn.text }, { args: [lifted] })
  })
}
