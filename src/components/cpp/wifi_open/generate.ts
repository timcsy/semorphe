/** `cpp:wifi_open` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:wifi_open', (node, ctx) => {
    const ssid = generateExpression((node.children.ssid ?? [])[0], ctx)
    const password = generateExpression((node.children.password ?? [])[0], ctx)
    return `${indent(ctx)}WiFi.begin(${ssid}, ${password});\n`
  })
}
