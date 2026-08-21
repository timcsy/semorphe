/**
 * `python:loop_iter` 的 **generate** 路——`for row in g`。
 *
 * ⚠️ **外層先寫**：`[x for row in g for x in row]` 的順序是從外到內，
 * 而語義樹是從內指向外（`outer`）——所以這裡先產外層。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:loop_iter', (node, ctx) => {
    const outer = (node.children.outer ?? [])[0]
    const head = outer ? `${generateExpression(outer, ctx)} ` : ''
    const src = (node.children.iterable ?? [])[0]
    return `${head}for ${String(node.properties.obj ?? 'row')} in ${src ? generateExpression(src, ctx) : ''}`
  })
}
