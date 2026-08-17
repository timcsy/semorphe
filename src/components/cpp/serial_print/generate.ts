/**
 * `cpp:serial_print` 的 **generate** 路。
 *
 * ⚠️ `newline` 決定產出 `println` 還是 `print`——**一顆概念，兩個形態**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:serial_print', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'Serial')
    const method = String(node.properties.newline ?? 'true') === 'true' ? 'println' : 'print'
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    // ⚠️ 第二個引數（小數位數／進位）**有才產**——沒有的話不能產出一個空的逗號
    const formatNode = (node.children.format ?? [])[0]
    const args = formatNode ? `${value}, ${generateExpression(formatNode, ctx)}` : value
    return `${indent(ctx)}${obj}.${method}(${args});\n`
  })
}
