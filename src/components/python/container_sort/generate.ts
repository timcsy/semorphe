/** `python:container_sort` 的 **generate** 路——`sorted(…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_sort', (node, ctx) => {
    const parts = (node.children.obj ?? []).map((v) => generateExpression(v, ctx))
    // ⚠️ **空的那一格不寫**——`sorted(xs, key=)` 不是合法的 Python
    for (const slot of ['key', 'reverse'] as const) {
      const v = (node.children[slot] ?? [])[0]
      if (v) parts.push(`${slot}=${generateExpression(v, ctx)}`)
    }
    return `sorted(${parts.join(', ')})`
  })
}
