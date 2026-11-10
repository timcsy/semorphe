/** `cpp:class_def` 的 **generate** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import { baseClauseCode } from '../../../languages/cpp/base-clause'
import { componentTraits } from '../../../core/component/traits'
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
      const section = (text: string, body: typeof publicBody): void => {
        if (body.length === 0) return
        code += label(text)
        code += generateBody(body, indented(ctx))
      }
      // 🔴 成員的本體看得到整個類別，而【簽名】只看得到寫在它前面的型別：`class L { struct Node {…}; public: void f(Node* p) {…} };`
      //    把 public 排前面，`Node` 就成了未宣告（394 盲測）。私有區宣告了型別時，它排最前面
      if (privateBody.some((n) => componentTraits(n.componentId)?.declaresTypeName === true)) section('private', privateBody)
      section('public', publicBody)
      section('protected', protectedBody)
      if (!privateBody.some((n) => componentTraits(n.componentId)?.declaresTypeName === true)) section('private', privateBody)
      code += `${indent(ctx)}};\n`
      return code
    })
}
