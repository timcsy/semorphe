/** `python:pair_make` 的 **generate** 路——`鍵: 值`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

const one = (ns: unknown[] | undefined, ctx: Parameters<NodeGenerator>[1]): string => {
  const n = (ns ?? [])[0]
  return n ? generateExpression(n as never, ctx) : ''
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:pair_make', (node, ctx) => `${one(node.children.key, ctx)}: ${one(node.children.value, ctx)}`)
}
