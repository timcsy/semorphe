/** `cpp:serial_read_number` 的 **generate** 路（435）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:serial_read_number', (node) => {
    return `${String(node.properties.obj ?? 'Serial')}.parseInt()`
  })
}
