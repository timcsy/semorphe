/** `python:exception_case` 的 **generate** 路——`except X:` ＋ 縮排的一段。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText} from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:exception_case', (node, ctx) => {
    const exc = String(node.properties.exception ?? '')
    // ⚠️ 沒有型別就不可能有 `as`——`except as e:` 是語法錯誤
    const alias = exc ? String(node.properties.alias ?? '') : ''
    const inner = indented(ctx)
    const body = node.children.body ?? []
    // 🔴 **每一段標頭都要先算進行號**（2026-08-24）——否則那一段主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    const head = `${indent(ctx)}except${exc ? ` ${exc}` : ''}${alias ? ` as ${alias}` : ''}:\n`
    trackOwnText(ctx, head)
    const code = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return head + code
  })
}
