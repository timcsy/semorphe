/** `python:var_assign_sequence` 的 **generate** 路——`x, y = p`。 */
import type { NodeGenerator, GeneratorContext } from '../../../core/projection/code-generator'
import type { SemanticNode } from '../../../core/types'
import { indent, generateExpression } from '../../../core/projection/code-generator'

/** 最外層的元組預設不帶括號，原文寫了（`bareTuple === false`）才帶；一格的要留逗號。 */
function patternText(p: SemanticNode, ctx: GeneratorContext): string {
  if (!p.componentId.endsWith(':tuple_make') || p.metadata?.layoutHints?.bareTuple === false) return generateExpression(p, ctx)
  const items = (p.slots.items ?? []).map((x) => generateExpression(x, ctx))
  return items.length === 1 ? `${items[0]},` : items.join(', ')
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_assign_sequence', (node, ctx) => {
    const pattern = (node.slots.pattern ?? [])[0]
    // 樣式最外層的元組不帶括號（`a, (b, c) = …`）——除非原文寫了（`(a, b) = …`），與 `for` 的目標同一條（第 420 刀）
    const names = pattern ? patternText(pattern, ctx)
      : (node.slots.targets ?? []).map((t) => String(t.properties.name ?? '')).join(', ')
    const v = (node.slots.value ?? [])[0]
    // 右邊也一樣：`a, b = 1, 2` 是學生寫的樣子；走過積木（排版註記不跟著走）也不該多出括號（第 421 刀走真積木抓到）
    return `${indent(ctx)}${names} = ${v ? patternText(v, ctx) : 'None'}\n`
  })
}
