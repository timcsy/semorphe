/** `cpp:pin_constant` 的 **generate** 路——名字原樣寫回去。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pin_constant', (node, _ctx) => String(node.properties.value ?? 'HIGH'))
}
