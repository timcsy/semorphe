/** `python:container_find` 的 **generate** 路——`x in xs` ／ `x not in xs`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

const one = (ns: unknown[] | undefined, ctx: Parameters<NodeGenerator>[1]): string => {
  const n = (ns ?? [])[0]
  return n ? generateExpression(n as never, ctx) : ''
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_find', (node, ctx) => {
    const op = String(node.properties.operator ?? 'in')
    return `${one(node.children.needle, ctx)} ${op} ${one(node.children.haystack, ctx)}`
  })
}
