/** `python:literal_bool` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:literal_bool', (node) => String(node.properties.value ?? 'True'))
}
