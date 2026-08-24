/** `python:loop_for` 的 **generate** 路——for-each，縮排不是大括號。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText} from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:loop_for', (node, ctx) => {
    // 多目標時 `targets` 是唯一的真實；單一目標仍走 `obj`（見 component.json 的說明）
    const targets = node.children.targets ?? []
    const name = targets.length > 0
      ? targets.map((t) => String(t.properties.name ?? '')).join(', ')
      : String(node.properties.obj ?? 'i')
    const it = generateExpression((node.children.iterable ?? [])[0], ctx)
    const body = node.children.body ?? []
    const inner = indented(ctx)
    // 🔴 **標頭那一行要先算進行號**（2026-08-24）——否則主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    //    見 `core/projection/code-generator.ts` 的 `trackOwnText`。
    const head = `${indent(ctx)}for ${name} in ${it}:\n`
    trackOwnText(ctx, head)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    return head + bodyCode
  })
}
