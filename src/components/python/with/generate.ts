/** `python:with` 的 **generate** 路——`with open(p) as f:`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression, generateBody, indent, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:with', (node, ctx) => {
    const v = generateExpression((node.children.value ?? [])[0], ctx)
    const name = String(node.properties.name ?? '').trim()
    const head = `${indent(ctx)}with ${v}${name ? ` as ${name}` : ''}:\n`
    // ⚠️ **主體要另一層縮排**，而空主體要有 `pass`——空的區塊在 Python 是語法錯誤
    const kids = node.children.body ?? []
    const inner = indented(ctx)
    return head + (kids.length > 0 ? generateBody(kids, inner) : `${indent(inner)}pass\n`)
  })
}
