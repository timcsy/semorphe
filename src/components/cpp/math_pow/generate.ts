/** `cpp:math_pow` 的 **generate** 路——從 `std/cmath/generators.ts` 原封搬過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_pow', (node, ctx) => {
    const base = generateExpression((node.slots.base ?? [])[0], ctx)
    const exponent = generateExpression((node.slots.exponent ?? [])[0], ctx)
    return `pow(${base}, ${exponent})`
  })
}
