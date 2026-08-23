/** `python:string_fill` 的 **generate** 路——`s.zfill(3)`／`s.rjust(5, "0")`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_fill', (node, ctx) => {
    const method = String(node.properties.method ?? 'zfill')
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const parts = [generateExpression((node.children.width ?? [])[0], ctx)]
    const fill = (node.children.fill ?? [])[0]
    // ⚠️ **補零那一個不吃第二個引數**——照樣印出去會產出一個跑不動的呼叫
    if (fill && method !== 'zfill') parts.push(generateExpression(fill, ctx))
    return `${o}.${method}(${parts.join(', ')})`
  })
}
