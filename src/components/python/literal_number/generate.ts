/** `python:literal_number` 的 **generate** 路——`42`／`3.14`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:literal_number', (node, _ctx) => String(node.properties.value ?? '0'))
}
