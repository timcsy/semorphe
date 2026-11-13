/** `cpp:arduino_string_trim` 的 **generate** 路（435）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:arduino_string_trim', (node, ctx) => {
    const obj = genReceiver((node.slots.obj ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.trim();\n`
  })
}
