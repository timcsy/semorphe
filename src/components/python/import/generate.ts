/** `python:import` 的 **generate** 路——`import math`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:import', (node, ctx) => `${indent(ctx)}import ${node.properties.name ?? 'math'}\n`)
}
