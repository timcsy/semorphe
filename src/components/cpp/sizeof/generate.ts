/** `cpp:sizeof` 的 **generate** 路——對象是型別／名字（文字 `target`）或運算式（接點 `expr`，355）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { cTypeText } from '../../../languages/cpp/target-dialect'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:sizeof', (node, ctx) => {
    const expr = node.slots.expr?.[0]
    if (expr) return `sizeof(${generateExpression(expr, ctx)})`
    // C 目標：`sizeof(P)` → `sizeof(struct P)`（只有宣告過的 struct 名字；變數名不會在名單上——357）
    const target = String(node.properties.target ?? 'int')
    return `sizeof(${ctx._structNames ? cTypeText(target, ctx._structNames) : target})`
  })
}
