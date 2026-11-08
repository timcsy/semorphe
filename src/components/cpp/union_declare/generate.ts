/** `cpp:union_declare` 的 **generate** 路（照同族的結構定義）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:union_declare', (node, ctx) => {
    const name = String(node.properties.name ?? 'MyUnion')
    const members = node.slots.members ?? []
    const alias = String(node.properties.typedef_alias ?? '')
    const head = alias ? `typedef union ${name ? `${name} ` : ''}{` : `union ${name || 'MyUnion'} {`
    return `${indent(ctx)}${head}\n${generateBody(members, indented(ctx))}${indent(ctx)}}${alias ? ` ${alias}` : ''};\n`
  })
}
