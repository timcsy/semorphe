/** `cpp:serial_read` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:serial_read', (node) => `${String(node.properties.obj ?? 'Serial')}.read()`)
}
