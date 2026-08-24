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
    // 🔴 **`async def` 整顆走誠實降級**（2026-08-24，第五十五條護欄第一次跑抓到的）。
    //    `async` 是 `function_definition` 的一個**匿名子節點**，而這顆元件沒有地方放它
    //    ——收一半的症狀是 `async def f()` 產回 `def f()`：**協程變成普通函式**，
    //    合法、測試全綠、而**行為不同**。
    //
    // > **一個關鍵字被安靜吃掉，與一段程式碼被安靜丟掉是同一件事。**
    if (node.children.some((c) => !c.isNamed && c.text === 'async')) return null

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
      } else if (p.type === 'typed_parameter' || p.type === 'typed_default_parameter') {
        // 🔴 **型別註記**（`def add(a: int, b: int) -> int`）——AI 生的 Python 到處都是，
        //    而它之前讓整顆函式定義降級。第五十三條護欄點名的。
        //
        // ⚠️ 型別在這個直譯器裡**不參與任何判斷**（Python 自己也不會）——
        //    它是寫給人看的。所以它進 `param_decl` 的 `type` 那一格（本來就在），
        //    產得回去、看得到，而**不假裝我們會檢查它**。
        const nm = p.type === 'typed_parameter'
          ? p.namedChildren.find((c) => c.type === 'identifier')
          : p.childForFieldName('name')
        const ty = p.childForFieldName('type')
        if (!nm || !ty) { unsupported = true; continue }
        params.push(createNode('param_decl', {
          type: ty.text,
          name: nm.text,
          ...(p.type === 'typed_default_parameter'
            ? { default: p.childForFieldName('value')?.text ?? '' } : {}),
        }))
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

    // 回傳型別同理——寫給人看的，不參與判斷
    const ret = node.childForFieldName('return_type')
    return createNode(
      'python:func_def',
      { name, ...(ret ? { returns: ret.text } : {}) },
      { params, body: statements },
    )
  })
}
