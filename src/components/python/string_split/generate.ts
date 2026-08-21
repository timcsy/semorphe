/** `python:string_split` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_split', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const v = generateExpression((node.children.value ?? [])[0], ctx)
    return `${o}.split(${v})`
  })
}
