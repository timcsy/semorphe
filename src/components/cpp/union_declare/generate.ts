/** `cpp:union_declare` 的 **generate** 路（照同族的結構定義）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:union_declare', (node, ctx) => {
    // 空名字＝匿名（typedef 的、或結構裡的匿名成員 `union { … };`，358）——不補預設名字
    const name = String(node.properties.name ?? 'MyUnion')
    const members = node.slots.members ?? []
    const alias = String(node.properties.typedef_alias ?? '')
    const head = alias ? `typedef union ${name ? `${name} ` : ''}{` : `union ${name ? `${name} ` : ''}{`
    return `${indent(ctx)}${head}\n${generateBody(members, indented(ctx))}${indent(ctx)}}${alias ? ` ${alias}` : ''};\n`
  })
}
