/** `cpp:class_def` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  // OOP concepts
    g.set('cpp:class_def', (node, ctx) => {
      const name = node.properties.name ?? 'MyClass'
      const baseClass = node.properties.base_class ?? ''
      const baseAccess = node.properties.base_access ?? 'public'
      const publicBody = node.children.public ?? []
      const protectedBody = node.children.protected ?? []
      const privateBody = node.children.private ?? []
      const inheritance = baseClass ? ` : ${baseAccess} ${baseClass}` : ''
      let code = `${indent(ctx)}class ${name}${inheritance}${openBrace(ctx)}\n`
      if (publicBody.length > 0) {
        code += `${indent(ctx)}public:\n`
        code += generateBody(publicBody, indented(ctx))
      }
      if (protectedBody.length > 0) {
        code += `${indent(ctx)}protected:\n`
        code += generateBody(protectedBody, indented(ctx))
      }
      if (privateBody.length > 0) {
        code += `${indent(ctx)}private:\n`
        code += generateBody(privateBody, indented(ctx))
      }
      code += `${indent(ctx)}};\n`
      return code
    })
}
