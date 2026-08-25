/** `cpp:constructor` 的 **generate** 路——從共用檔原封剪過來（批次第二十六批：OOP 方法族）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor } from '../../../languages/cpp/core/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText, generateExpression } from '../../../core/projection/code-generator'
import { formatParams } from '../../../languages/cpp/core/generators/statements'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:constructor', (node, ctx) => {
      const className = node.properties.class_name ?? 'MyClass'
      const paramChildren = node.children.params ?? []
      const inits = node.children.inits ?? []
      const body = node.children.body ?? []
      const paramStr = formatParams(paramChildren)
      // `v = x` → `v(x)`：初始化列的語法是**呼叫的形狀**，不是賦值的形狀
      const initStr = inits.length > 0
        // 🟢 **初始化列的左值也是接點**（2026-08-25）——在此之前這裡讀
        //    `n.properties.obj`（一個字串），而 `cpp:var_assign` 的左值接點化
        //    之後那一格不存在了，於是每一筆都退成 `x(...)`。
        //    ⚠️ 這是**同一次改動的第二個消費者**，而它不在那顆膠囊裡。
        ? ` : ${inits.map((n) => {
          const t = (n.children?.target ?? [])[0]
          const name = t ? generateExpression(t, ctx) : 'x'
          return `${name}(${generateExpression((n.children?.value ?? [])[0], ctx)})`
        }).join(', ')}`
        : ''
      const header = `${indent(ctx)}${className}(${paramStr})${initStr}${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
