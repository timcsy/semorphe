/** `cpp:var_declare_sequence` 的 **generate** 路——`auto [a, b] = e;`／`auto& [a, b] = e;` */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare_sequence', (node, ctx) => {
    const names = (node.slots.targets ?? []).map((t) => String(t.properties.name ?? '')).join(', ')
    // ⚠️ **`&` 跟著 `auto` 走**，不是跟著第一個名字——`auto& [k, v]` 不是 `auto [&k, v]`。
    const amp = node.properties.binding === 'reference' ? '&' : ''
    const v = (node.slots.value ?? [])[0]
    const rhs = v ? ` = ${generateExpression(v, ctx)}` : ''
    return `${indent(ctx)}auto${amp} [${names}]${rhs};\n`
  })
}
