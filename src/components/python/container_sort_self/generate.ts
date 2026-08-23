/** `python:container_sort_self` 的 **generate** 路——`xs.sort(key=…, reverse=…)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression, indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_sort_self', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const parts: string[] = []
    // ⚠️ **空的那一格不寫**——`xs.sort(key=)` 不是合法的 Python
    for (const slot of ['key', 'reverse'] as const) {
      const v = (node.children[slot] ?? [])[0]
      if (v) parts.push(`${slot}=${generateExpression(v, ctx)}`)
    }
    return `${indent(ctx)}${o}.sort(${parts.join(', ')})\n`
  })
}
