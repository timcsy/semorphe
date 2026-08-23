/**
 * `python:container_pop` 的 **generate** 路——`xs.pop()` / `xs.pop(0)`。
 *
 * 🔴 **不自己補縮排與換行**：這顆的角色是 `both`，而核心的
 * 「裸運算式當一行時要怎麼收尾」是**語言宣告的**（見 `core/expression-statement.ts`）。
 * 自己包一層的症狀是語句位置多一個縮排、運算式位置多一個換行。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_pop', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const i = (node.children.index ?? [])[0]
    return `${o}.pop(${i ? generateExpression(i, ctx) : ''})`
  })
}
