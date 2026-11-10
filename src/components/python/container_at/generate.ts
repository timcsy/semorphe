/** `python:container_at` 的 **generate** 路——`nums[0]`／`ages["小明"]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

const one = (ns: unknown[] | undefined, ctx: Parameters<NodeGenerator>[1]): string => {
  const n = (ns ?? [])[0]
  return n ? generateExpression(n as never, ctx) : ''
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_at', (node, ctx) => `${genReceiver((node.slots.target ?? [])[0], ctx)}[${one(node.slots.key, ctx)}]`)
}
