/** `python:set_make` 的 **generate** 路——`{1, 2, 3}`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:set_make', (node, ctx) => {
    const items = node.slots.items ?? []
    // 🔴 空集合沒有字面寫法：`{}` 是空字典（cella 對照元件時指出）。
    //    lift 不會產生空的這顆，而積木上把元素全拿掉就是它。
    if (items.length === 0) return 'set()'
    return `{${items.map((v) => generateExpression(v, ctx)).join(', ')}}`
  })
}
