/** `python:global` 的 **generate** 路——`global count`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:global', (node, ctx) => `${indent(ctx)}global ${String(node.properties.name ?? '')}\n`)
}
