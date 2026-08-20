/** `python:func_def` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:func_def', (node, ctx) => {
    const name = String(node.properties.name ?? 'f')
    // ⚠️ **參數是結構節點不是字串**（spec 169）——每一顆帶一個 `name`。
    const params = (node.children.params ?? []).map((p) => String(p.properties.name ?? '')).filter(Boolean)
    const body = node.children.body ?? []
    const inner = indented(ctx)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return `${indent(ctx)}def ${name}(${params.join(', ')}):\n${bodyCode}`
  })
}
