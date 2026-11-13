/** `cpp:arduino_string_as_int` 的 **generate** 路（435）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:arduino_string_as_int', (node, ctx) => `${genReceiver((node.slots.obj ?? [])[0], ctx)}.toInt()`)
}
