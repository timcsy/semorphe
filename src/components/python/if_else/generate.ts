/** `python:if_else` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:if_else', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    // ⚠️ **每次重算 `indented(ctx)`**——`generateBody` 會在傳進去的 ctx 上記帳
    // （`trackOwnText` 那一族），共用一份的話第二次呼叫拿到的縮排已經被動過。
    // 症狀：`else:` 底下完全沒有縮排，而 `if` 底下是對的。
    const gen = (kids: typeof node.children.body) => {
      const inner = indented(ctx)
      return (kids ?? []).length > 0 ? generateBody(kids ?? [], inner) : `${indent(inner)}pass\n`
    }
    return `${indent(ctx)}if ${cond}:\n${gen(node.children.body)}` +
           `${indent(ctx)}else:\n${gen(node.children.else_body)}`
  })
}
