/** `cpp:math_is_nan` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:math_is_nan', (node, ctx) => {
    return `isnan(${generateExpression((node.children.value ?? [])[0], ctx)})`
  })
}
