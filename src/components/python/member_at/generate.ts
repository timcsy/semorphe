/** `python:member_at` 的 **generate** 路——`math.pi`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:member_at', (node, ctx) => {
    const obj = (node.slots.obj ?? [])[0]
    return `${genReceiver(obj, ctx)}.${node.properties.member ?? ''}`
  })
}
