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
    return `${indent(ctx)}${obj}.${method}(${value});\n`
  })
}
