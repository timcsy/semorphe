/** `python:import_from` 的 **generate** 路——`from math import sqrt, floor`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:import_from', (node, ctx) =>
    `${indent(ctx)}from ${String(node.properties.module ?? 'math')} import ${String(node.properties.names ?? 'sqrt')}\n`)
}
