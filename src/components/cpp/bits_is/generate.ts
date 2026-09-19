/** `cpp:bits_is` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:bits_is', (node, ctx) => {
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    // 🔴 **產回使用者寫的那個方法名**——那一格裝的就是他寫的字。
    return `${obj}.${String(node.properties.method ?? 'any')}()`
  })
}
