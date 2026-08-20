/** `python:raw_expression` 的 **generate** 路——原文原樣，不縮排也不換行（它是運算式）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:raw_expression', (node, _ctx) => String(node.properties.code ?? ''))
}
