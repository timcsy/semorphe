/** `cpp:io_mode` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

/** `setting` → C++ 的函式名。與 lift 那一側是同一份對應的反向。 */
const NAMES: Record<string, string> = { width: 'setw', precision: 'setprecision', fill: 'setfill' }

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:io_mode', (node, ctx) => {
    const name = NAMES[String(node.properties.setting ?? 'width')] ?? 'setw'
    const v = (node.slots.value ?? [])[0]
    // ⚠️ 沒接上時產一個看得懂而**編得過**的預設——空的話會產出 `setw()`，那編不過。
    return `${name}(${v ? generateExpression(v, ctx) : '0'})`
  })
}
