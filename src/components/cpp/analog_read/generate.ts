/** `cpp:analog_read` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:analog_read', (node, ctx) =>
    `analogRead(${generateExpression((node.children.pin ?? [])[0], ctx)})`)
}
