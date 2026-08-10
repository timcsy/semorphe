/**
 * `cpp:map_at` 的 **lift** 路——**`subscript_expression` 的一個分支**
 *
 * ⚠️ **判別寫成完全具體的**，不倚賴「排在第幾個」——分支的登錄順序來自
 * `import.meta.glob` 的檔名排序，那不是任何人設計的。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('subscript_expression', 'cpp/map_at', (node, ctx): SemanticNode | null => {
    // `m[key]` 而 `m` 是對應表——**差別在律**：陣列索引超出範圍是錯誤，
    // 對應表的鍵不存在是插入。判準是根變數的型別（辨識脈絡查得到）。
    const arrayNode = node.childForFieldName('argument') ?? node.namedChildren[0]
    if (arrayNode?.type === 'subscript_expression') return null
    const name = arrayNode?.text ?? 'arr'
    if (ctx.data.getType(name) !== 'map') return null
    const indicesNode = node.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const indexNode = indicesNode?.namedChildren[0] ?? node.childForFieldName('index') ?? node.namedChildren[1]
    const index = indexNode ? ctx.lift(indexNode) : null
    return createNode('cpp:map_at', { obj: name }, { key: index ? [index] : [] })
  })
}
