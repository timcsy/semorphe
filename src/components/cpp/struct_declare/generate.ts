/** `cpp:struct_declare` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:struct_declare', (node, ctx) => {
      const name = node.properties.name ?? 'MyStruct'
      const members = node.children.members ?? []
      let code = `${indent(ctx)}struct ${name} {\n`
      code += generateBody(members, indented(ctx))
      code += `${indent(ctx)}};\n`
      return code
    })
}
