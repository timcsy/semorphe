/** `cpp:dht_read` 的 **generate** 路——`quantity` 決定叫哪一個方法。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:dht_read', (node) => {
    const obj = String(node.properties.obj ?? 'dht')
    const method = node.properties.quantity === 'temperature' ? 'readTemperature' : 'readHumidity'
    return `${obj}.${method}()`
  })
}
