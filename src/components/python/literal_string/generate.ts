/** `python:literal_string` 的 **generate** 路——`"hi"`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:literal_string', (node, _ctx) => `"${node.properties.value ?? ''}"`)
}
