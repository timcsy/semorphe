/** `python:string_insert` 的 **generate** 路——`{值}`、`{值!r}`、`{值:格式}`、`{值!r:格式}`，以及自我說明 `{值=}`／`{值 = }`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_insert', (node, ctx) => {
    const value = (node.slots.value ?? [])[0]
    const inner = value ? generateExpression(value, ctx) : ''
    const format = String(node.properties.format ?? '')
    const conv = String(node.properties.conversion ?? '')
    const selfDoc = String(node.properties.selfDoc ?? '')
    // 驚嘆號與冒號都是語法，只在**真的有**轉換／格式時才出現（先轉換、再套格式——Python 的語法順序）
    // 自我說明的 `=` 緊接在運算式後面、轉換之前（`{x=!r:>6}`）
    return `{${inner}${selfDoc}${conv ? `!${conv}` : ''}${format ? `:${format}` : ''}}`
  })
}
