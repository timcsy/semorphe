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

    // 🔴 **預設值 2026-08-21 收進來了**。在那之前這裡的註解寫著理由：
    // 「收一半會讓 `def f(a, b=1)` 產回 `def f(a, b)`，而使用者的預設值就不見了」
    // ——那個判斷是對的，所以整顆走誠實降級。現在收得了，邊界往前推一格。
    //
    // 🟢 **`*args` 收得下**（2026-08-22）：`list_splat_pattern`。
    //    它在 `param_decl` 上多一個 `variadic` 標記——**不是把星號寫進名字裡**：
    //    名字裡的星號會讓每一個讀名字的人各自再解析一次。
    // ⚠️ `**kwargs`（`dictionary_splat_pattern`）**仍然沒有被收**
    //    ——它要的是「把剩下的具名引數收成一個字典」，而那是另一件事。
    const paramsNode = node.childForFieldName('parameters')
    const params: SemanticNode[] = []
    let unsupported = false
    for (const p of paramsNode?.namedChildren ?? []) {
      if (p.type === 'identifier') {
        params.push(createNode('param_decl', { type: '', name: p.text }))
      } else if (p.type === 'default_parameter') {
        // 🔴 **預設值存原文，不是 lift 出來的樹**：它是寫在簽名上的一個字面，
        //    而積木上那一格是文字欄位。lift 成樹會讓它需要一個插槽，
        //    而那個插槽在函式定義的積木上沒有地方放。
        params.push(createNode('param_decl', {
          type: '',
          name: p.childForFieldName('name')?.text ?? '',
          default: p.childForFieldName('value')?.text ?? '',
        }))
      } else if (p.type === 'list_splat_pattern') {
        const n = p.namedChildren[0]
        if (n?.type !== 'identifier') { unsupported = true; continue }
        params.push(createNode('param_decl', { type: '', name: n.text, variadic: 'list' }))
      } else {
        unsupported = true
      }
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
