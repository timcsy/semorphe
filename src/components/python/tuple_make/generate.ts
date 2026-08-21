/**
 * `python:tuple_make` 的 **generate** 路——`(3, 4)`。
 *
 * ⚠️ **只有一格時要多一個逗號**：`(3)` 在 Python 是一個括號包起來的數字，
 * `(3,)` 才是一個一格的 tuple。少了那個逗號會產出**語義不同**的合法程式碼。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:tuple_make', (node, ctx) => {
    const items = (node.children.items ?? []).map((v) => generateExpression(v, ctx))
    if (items.length === 1) return `(${items[0]},)`
    // 🔴 **括號是排版**——投影記住它（見 `lift-strategy.ts` 的檔頭）。
    //    `a, b = 1, 2` 沒有括號，而硬加上去等於改了使用者的碼。
    return node.metadata?.layoutHints?.bareTuple === true ? items.join(', ') : `(${items.join(', ')})`
  })
}
