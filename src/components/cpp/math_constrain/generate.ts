/** `cpp:math_constrain` 的 **generate** 路——三個引數都是必要的。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_constrain', (node, ctx) => {
    const v = generateExpression((node.children.value ?? [])[0], ctx)
    const lo = generateExpression((node.children.low ?? [])[0], ctx)
    const hi = generateExpression((node.children.high ?? [])[0], ctx)
    return `constrain(${v}, ${lo}, ${hi})`
  })
}
