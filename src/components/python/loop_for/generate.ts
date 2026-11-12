/** `python:loop_for` 的 **generate** 路——for-each，縮排不是大括號。 */
import type { NodeGenerator, GeneratorContext } from '../../../core/projection/code-generator'
import type { SemanticNode } from '../../../core/types'
import { indent, indented, generateExpression, generateBody, trackOwnText} from '../../../core/projection/code-generator'

/**
 * 目標樣式（第 420 刀）：最外層的元組【預設不帶括號】（`for i, (a, b) in …`）——只有原文寫了括號（`for (a, b) in …`）才帶。
 * ⚠️ 與運算式位置的元組相反：那邊預設帶括號、原文沒有才省（`tuple_make` 的 `bareTuple`）。這裡反過來，
 * 是因為積木那一路不存排版註記，而 `for i, (a, b) in` 才是學生寫的樣子；`for (i, (a, b)) in` 也合法，但不是他寫的。
 */
function patternText(p: SemanticNode, ctx: GeneratorContext): string {
  if (!p.componentId.endsWith(':tuple_make') || p.metadata?.layoutHints?.bareTuple === false) return generateExpression(p, ctx)
  const items = (p.slots.items ?? []).map((x) => generateExpression(x, ctx))
  return items.length === 1 ? `${items[0]},` : items.join(', ')
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:loop_for', (node, ctx) => {
    // `targets` 是唯一的真實（第 411 刀起單一名字也在裡面）；沒有時才退回 `obj`（只剩手組的樹）
    const targets = node.slots.targets ?? []
    const pattern = (node.slots.pattern ?? [])[0]
    const name = pattern ? patternText(pattern, ctx)
      : targets.length > 0
        ? targets.map((t) => String(t.properties.name ?? '')).join(', ')
        : String(node.properties.obj ?? 'i')
    const it = generateExpression((node.slots.iterable ?? [])[0], ctx)
    const body = node.slots.body ?? []
    const inner = indented(ctx)
    // 🔴 **標頭那一行要先算進行號**（2026-08-24）——否則主體裡每一顆的
    //    對應都往上偏一行，使用者按下積木時**反白到上一行**。
    //    見 `core/projection/code-generator.ts` 的 `trackOwnText`。
    const head = `${indent(ctx)}for ${name} in ${it}:\n`
    trackOwnText(ctx, head)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    // 🟢 `else:`（第 417 刀）——迴圈跑完而沒有遇到 `break` 時做的那一段
    const elseBody = node.slots.else_body ?? []
    if (elseBody.length === 0) return head + bodyCode
    const elseHead = `${indent(ctx)}else:\n`
    trackOwnText(ctx, elseHead)
    return head + bodyCode + elseHead + generateBody(elseBody, inner)
  })
}
