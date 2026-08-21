/**
 * `python:loop_for` 的 **lift** 路。
 *
 * ## 為什麼從純資料換成策略（2026-08-21）
 *
 * 原本 `left` 走 `extract: "text"`，而那筆樣式的 `_why` 自己寫著：
 *
 * > 「`for a, b in …` 的解構 `left` 是 `pattern_list`，`text` 會拿到 `a, b`：
 * > 🔴 **那是一個已知的邊界。**」
 *
 * 那句話是誠實的，而它的代價在執行期才付：迴圈宣告了一個**名字叫 `k, v` 的變數**，
 * 然後函式體讀 `k` 時說「沒有這個變數」。
 *
 * > **一個「字串裡藏著結構」的欄位，在投影上看起來完全正常
 * > ——它壞在有人真的去用那個結構的時候。**
 *
 * 🟢 現在多目標走 `targets`（`param_decl` 子節點，與同族函式定義的參數同一個做法），
 * 單一目標仍然走 `obj`——**舊存檔照樣打得開**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftLoopFor', (node, ctx) => {
    const left = node.childForFieldName('left')
    const right = node.childForFieldName('right')
    const body = node.childForFieldName('body')

    const children: Record<string, SemanticNode[]> = {}
    const properties: Record<string, string> = {}

    if (left?.type === 'pattern_list') {
      children.targets = left.namedChildren
        .filter((c) => c.type === 'identifier')
        .map((c) => createNode('param_decl', { type: '', name: c.text }))
      // ⚠️ `obj` 仍然填第一個名字——存檔格式與積木的那個欄位都還在用它。
      properties.obj = String(children.targets[0]?.properties.name ?? 'i')
    } else {
      properties.obj = left?.text ?? 'i'
    }

    const it = right ? ctx.lift(right) : null
    children.iterable = it ? [it] : []
    // 迴圈體：`block` 節點由核心的 `_compound` 樣式拆開
    const liftedBody = body ? ctx.lift(body) : null
    children.body = liftedBody
      ? (liftedBody.componentId === '_compound' ? (liftedBody.children.body ?? []) : [liftedBody])
      : []

    return createNode('python:loop_for', properties, children)
  })
}
