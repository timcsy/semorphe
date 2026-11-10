/** `cpp:friend_class` 的 **generate** 路（第 389 刀）：`friend class Bank;` */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:friend_class', (node, ctx) => {
    const line = `${indent(ctx)}friend ${node.properties.tag ?? 'class'} ${node.properties.name ?? 'Other'};\n`
    trackOwnText(ctx, line)
    return line
  })
}
