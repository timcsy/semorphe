/** `cpp:range_sort` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:range_sort', (node, ctx) => {
    const begin = (node.properties.begin as string) ?? 'v.begin()'
    const end = (node.properties.end as string) ?? 'v.end()'
    const cmp = (node.children.comparator ?? [])[0]
    // 三態：沒有比較器 → 兩引數；有 → 三引數。**空陣列與不存在產出相同**，
    // 因為「接了一個空插槽」與「沒接」對 C++ 是同一件事。
    return cmp
      ? `${indent(ctx)}sort(${begin}, ${end}, ${generateExpression(cmp, ctx)});\n`
      : `${indent(ctx)}sort(${begin}, ${end});\n`
  })
}
