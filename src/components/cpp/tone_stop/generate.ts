/** `cpp:tone_stop` 的 **generate** 路——⚠️ 產出的函式名是 `noTone`，不是身分。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:tone_stop', (node, ctx) => {
    const pin = generateExpression((node.children.pin ?? [])[0], ctx)
    return `${indent(ctx)}noTone(${pin});\n`
  })
}
