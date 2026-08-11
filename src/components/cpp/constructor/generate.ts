/** `cpp:constructor` 的 **generate** 路——從共用檔原封剪過來（批次第二十六批：OOP 方法族）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'
import { formatParams } from '../../../languages/cpp/core/generators/statements'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:constructor', (node, ctx) => {
      const className = node.properties.class_name ?? 'MyClass'
      const paramChildren = node.children.params ?? []
      const initList = node.properties.init_list ?? ''
      const body = node.children.body ?? []
      const paramStr = formatParams(paramChildren)
      const initStr = initList ? ` : ${initList}` : ''
      const header = `${indent(ctx)}${className}(${paramStr})${initStr}${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
