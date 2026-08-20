/**
 * `python:func_def` 的 **lift** 路——具名策略。
 *
 * ⚠️ **為什麼不是純資料**：參數列要變成一串**結構節點**（`param_decl`），
 * 而 `fieldMappings` 的 `extract` 只產得出字串（`text`）或「lift 出來的東西」（`lift`）。
 * 而 `a` 這個 identifier lift 出來會是一顆**變數參照**——那讀起來像「把 a 的值當參數」。
 *
 * > **參數的名字與變數的引用長得一模一樣，而它們是兩件事。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftFuncDef', (node, ctx) => {
    const name = node.childForFieldName('name')?.text ?? 'f'

    // ⚠️ 只收**單純的名字**參數。`a=1`（預設值）、`*args`、`**kwargs` 的節點型別
    // 分別是 `default_parameter`／`list_splat_pattern`／`dictionary_splat_pattern`
    // ——它們**沒有被收**，而那是一個【刻意的邊界】：收一半會讓
    // `def f(a, b=1)` 產回 `def f(a, b)`，而使用者的預設值就不見了。
    const paramsNode = node.childForFieldName('parameters')
    const params: SemanticNode[] = []
    let unsupported = false
    for (const p of paramsNode?.namedChildren ?? []) {
      if (p.type === 'identifier') params.push(createNode('param_decl', { type: '', name: p.text }))
      else unsupported = true
    }
    // 認不出來的參數形式 → 整顆走誠實降級，而不是產出一個少了東西的函式定義。
    if (unsupported) return null

    const body = node.childForFieldName('body')
    const lifted = body ? ctx.lift(body) : null
    const statements = lifted
      ? (lifted.componentId === '_compound' ? (lifted.children.body ?? []) : [lifted])
      : []

    return createNode('python:func_def', { name }, { params, body: statements })
  })
}
