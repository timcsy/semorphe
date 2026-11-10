/** `cpp:friend_function` 的 **generate** 路（第 389 刀）：`friend int peek(const A& a);` */
import { formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:friend_function', (node, ctx) => {
    const line = `${indent(ctx)}friend ${node.properties.return_type ?? 'void'} ${node.properties.name ?? 'helper'}(${formatParams(node.slots.params ?? [])});\n`
    trackOwnText(ctx, line)
    return line
  })
}
