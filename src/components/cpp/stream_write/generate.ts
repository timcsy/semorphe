/** `cpp:stream_write` 的 **generate** 路：`os << a << b;`，排版與印到螢幕那顆共用 `<<` 的括號規則。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'
import { needsParensInCout } from '../../../languages/cpp/std/iostream/generators'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:stream_write', (node, ctx) => {
    const stream = node.slots.stream?.[0]
    const target = stream ? generateExpression(stream, ctx) : 'os'
    const parts = (node.slots.values ?? []).map((v) => {
      const expr = generateExpression(v, ctx)
      return needsParensInCout(v) ? `(${expr})` : expr
    })
    return `${indent(ctx)}${[target, ...parts].join(' << ')};\n`
  })
}
