/** `python:compare_step` 的 **generate** 路——比較鏈上的一段 `< d`（前面的空白由比較鏈接上）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:compare_step', (node, ctx) => {
    // 值那一格與鏈上其他運算元同一條規則（`prec + 1`）：`a < b < (c < d)` 的括號要留著
    const v = genChild((node.slots.value ?? [])[0], precedence(node) + 1, ctx)
    return `${String(node.properties.operator ?? '<')} ${v}`
  })
}
