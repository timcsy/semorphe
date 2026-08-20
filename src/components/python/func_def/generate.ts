/** `python:func_def` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:func_def', (node, ctx) => {
    const name = String(node.properties.name ?? 'f')
    const params = String(node.properties.params ?? '')
    const body = node.children.body ?? []
    const inner = indented(ctx)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return `${indent(ctx)}def ${name}(${params}):\n${bodyCode}`
  })
}
