/** `cpp:wifi_read` 的 **generate** 路——`quantity` 決定叫哪一個方法。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:wifi_read', (node) => {
    return `WiFi.${node.properties.quantity === 'address' ? 'localIP' : 'status'}()`
  })
}
