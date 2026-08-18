/** `cpp:dht_open` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:dht_open', (node, ctx) => {
    const obj = String(node.properties.obj ?? 'dht')
    return `${indent(ctx)}${obj}.begin();\n`
  })
}
