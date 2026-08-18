/** `cpp:serial_count` 的 **generate** 路——⚠️ 產出的方法名是 `available`，不是身分。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:serial_count', (node) => `${String(node.properties.obj ?? 'Serial')}.available()`)
}
