/**
 * `python:var_assign_expr` 的 **generate** 路——`n := len(xs)`。
 *
 * ⚠️ **這裡不自己加括號**：要不要括號由括號演算法決定（見膠囊的 `_traits_why`），
 * 而使用者原本寫的那一對由 `layoutHints.parenthesized` 記著。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_assign_expr', (node, ctx) => {
    const v = (node.children.value ?? [])[0]
    return `${node.properties.obj ?? 'n'} := ${v ? generateExpression(v, ctx) : ''}`
  })
}
