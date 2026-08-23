/** `python:container_enumerate` 的 **generate** 路——`enumerate(xs)` / `enumerate(xs, 1)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_enumerate', (node, ctx) => {
    const parts = (node.children.value ?? []).map((v) => generateExpression(v, ctx))
    const start = (node.children.start ?? [])[0]
    if (start) {
      const code = generateExpression(start, ctx)
      // ⚠️ **原本寫哪一種就產哪一種**——見膠囊的 `_why`
      parts.push(node.properties.start_style === 'keyword' ? `start=${code}` : code)
    }
    return `enumerate(${parts.join(', ')})`
  })
}
