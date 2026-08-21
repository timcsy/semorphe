/** `python:string_insert` 的 **generate** 路——`{值}` 或 `{值:格式}`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_insert', (node, ctx) => {
    const value = (node.children.value ?? [])[0]
    const inner = value ? generateExpression(value, ctx) : ''
    const format = String(node.properties.format ?? '')
    // 冒號是語法，只在**真的有格式**時才出現——空格式配一個裸冒號是合法但無意義的碼
    return format ? `{${inner}:${format}}` : `{${inner}}`
  })
}
