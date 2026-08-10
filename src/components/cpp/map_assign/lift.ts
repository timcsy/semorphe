/**
 * `cpp:map_assign` 的 **lift** 路——**`assignment_expression` 的一個分支**
 *
 * 原本是 `core/lifters/declarations.ts` 一個 if 鏈裡的一段。那個 if 鏈
 * **不是路由，是六顆元件各自的判別**——「左邊長成這樣時是我」是元件的知識。
 *
 * ⚠️ **判別寫成完全具體的**，不倚賴「排在第幾個」——分支的登錄順序來自
 * `import.meta.glob` 的檔名排序，**那不是任何人設計的**。
 * 這個專案已經被「後註冊的贏」咬過三次。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('assignment_expression', 'cpp/map_assign', (node, ctx): SemanticNode | null => {
    // `m[k] = v` 且 `m` 的型別是對應表——**型別查得到才是我**
    const op = node.children.find((c) => !c.isNamed)?.text ?? '='
    const left = node.childForFieldName('left')
    if (op !== '=' || left?.type !== 'subscript_expression') return null
    const innerNode = left.childForFieldName('argument') ?? left.namedChildren[0]
    if (innerNode?.type === 'subscript_expression') return null
    const name = innerNode?.text ?? 'arr'
    if (ctx.data.getType(name) !== 'map') return null
    const right = node.childForFieldName('right')
    const value = right ? ctx.lift(right) : null
    const indicesNode = left.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const indexNode = indicesNode?.namedChildren[0] ?? left.childForFieldName('index') ?? left.namedChildren[1]
    const index = indexNode ? ctx.lift(indexNode) : null
    return createNode('cpp:map_assign', { obj: name }, {
      key: index ? [index] : [],
      value: value ? [value] : [],
    })
  })
}
