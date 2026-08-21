/** `python:container_erase` 的 **generate** 路——`del d["a"]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_erase', (node, ctx) =>
    `${indent(ctx)}del ${generateExpression((node.children.target ?? [])[0], ctx)}\n`)
}
