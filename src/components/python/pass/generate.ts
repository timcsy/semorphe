/** `python:pass` 的 **generate** 路——`pass`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:pass', (node, ctx) => { void node; return `${indent(ctx)}pass\n` })
}
