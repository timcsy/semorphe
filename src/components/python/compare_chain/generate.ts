/** `python:compare_chain` 的 **generate** 路——`a < b < c`，第三段起接在後面（`< d`）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:compare_chain', (node, ctx) => {
    const prec = precedence(node)
    const a = genChild((node.slots.left ?? [])[0], prec, ctx)
    const b = genChild((node.slots.middle ?? [])[0], prec + 1, ctx)
    const c = genChild((node.slots.right ?? [])[0], prec + 1, ctx)
    // 每一段由「再比」那顆自己產出 `op 值`；`0` 是不加括號——它不是一個獨立的運算式
    const more = (node.slots.more ?? []).map((s) => ` ${genChild(s, 0, ctx)}`).join('')
    return `${a} ${String(node.properties.operator ?? '<')} ${b} ${String(node.properties.operator2 ?? '<')} ${c}${more}`
  })
}
