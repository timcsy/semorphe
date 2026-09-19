/** `cpp:bits_as` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:bits_as', (node, ctx) => {
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    // 🔴 **產回使用者寫的那個方法名**——`to_ullong` 不可以變成 `to_ulong`。
    return `${obj}.${String(node.properties.method ?? 'to_ulong')}()`
  })
}
