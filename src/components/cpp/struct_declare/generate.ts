/** `cpp:struct_declare` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import { baseClauseCode } from '../../../languages/cpp/base-clause'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:struct_declare', (node, ctx) => {
      const name = node.properties.name ?? 'MyStruct'
      const members = node.slots.members ?? []
      const inherit = baseClauseCode(String(node.properties.base_class ?? ''), String(node.properties.base_access ?? 'implicit'))   // spec 209
      // C 的 `typedef struct [Tag] { … } Alias;`（2026-11-08）——匿名的沒有 Tag
      const alias = String(node.properties.typedef_alias ?? '')
      if (alias) {
        let code = `${indent(ctx)}typedef struct ${node.properties.name ? `${node.properties.name}${inherit} ` : ''}{\n`
        code += generateBody(members, indented(ctx))
        code += `${indent(ctx)}} ${alias};\n`
        return code
      }
      let code = `${indent(ctx)}struct ${name}${inherit} {\n`
      code += generateBody(members, indented(ctx))
      code += `${indent(ctx)}};\n`
      return code
    })
}
