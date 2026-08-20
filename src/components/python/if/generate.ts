/**
 * `python:if` 的 **generate** 路——**縮排，不是大括號**。
 * 空的 body 要產 `pass`：沒有內容的 `if` 在 Python 是語法錯誤。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:if', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const body = node.children.body ?? []
    const inner = indented(ctx)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return `${indent(ctx)}if ${cond}:\n${bodyCode}`
  })
}
