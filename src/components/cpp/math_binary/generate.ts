/** `cpp:math_binary` 的 **generate** 路——從 `std/cmath/generators.ts` 原封搬過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_binary', (node, ctx) => {
    const func = (node.properties.func as string) ?? 'fmod'
    const arg1 = generateExpression((node.children.arg1 ?? [])[0], ctx)
    const arg2 = generateExpression((node.children.arg2 ?? [])[0], ctx)
    return `${func}(${arg1}, ${arg2})`
  })
}
