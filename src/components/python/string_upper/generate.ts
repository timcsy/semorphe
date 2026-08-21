/** `python:string_upper` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_upper', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    
    return `${o}.upper()`
  })
}
