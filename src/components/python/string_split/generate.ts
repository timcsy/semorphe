/** `python:string_split` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_split', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    // ⚠️ 沒有分隔字串時**不能產出一對空括號以外的東西**——`s.split()` 與
    //    `s.split(" ")` 在 Python **不是同一件事**（前者會丟掉頭尾的空段）。
    const sep = (node.children.value ?? [])[0]
    return `${o}.split(${sep ? generateExpression(sep, ctx) : ''})`
  })
}
