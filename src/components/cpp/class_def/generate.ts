/** `cpp:class_def` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import { baseClauseCode } from '../../../languages/cpp/base-clause'
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  // OOP components
    g.set('cpp:class_def', (node, ctx) => {
      const name = node.properties.name ?? 'MyClass'
      const baseClass = node.properties.base_class ?? ''
      const baseAccess = node.properties.base_access ?? 'public'
      const publicBody = node.slots.public ?? []
      const protectedBody = node.slots.protected ?? []
      const privateBody = node.slots.private ?? []
      const inheritance = baseClauseCode(String(baseClass), String(baseAccess))   // implicit 不寫存取（spec 209）
      let code = `${indent(ctx)}class ${name}${inheritance}${openBrace(ctx)}\n`
      trackOwnText(ctx, code)
      const label = (text: string): string => { const l = `${indent(ctx)}${text}:\n`; trackOwnText(ctx, l); return l }
      if (publicBody.length > 0) {
        code += label('public')
        code += generateBody(publicBody, indented(ctx))
      }
      if (protectedBody.length > 0) {
        code += label('protected')
        code += generateBody(protectedBody, indented(ctx))
      }
      if (privateBody.length > 0) {
        code += label('private')
        code += generateBody(privateBody, indented(ctx))
      }
      code += `${indent(ctx)}};\n`
      return code
    })
}
