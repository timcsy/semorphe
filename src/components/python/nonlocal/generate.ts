/** `python:nonlocal` 的 **generate** 路——`nonlocal count`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:nonlocal', (node, ctx) => `${indent(ctx)}nonlocal ${String(node.properties.name ?? '')}\n`)
}
