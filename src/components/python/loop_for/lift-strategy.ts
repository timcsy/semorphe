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

// 樣式裡只有名字、元組、展開——每一個葉子都綁一個新名字（`tuple_make/target-pattern.ts`，三處共用）
import { isNamePattern, firstName } from '../tuple_make/target-pattern'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftLoopFor', (node, ctx) => {
    const left = node.childForFieldName('left')
    const right = node.childForFieldName('right')
    const body = node.childForFieldName('body')

    const slots: Record<string, SemanticNode[]> = {}
    const properties: Record<string, string> = {}

    // 🔴 **單一名字也進 `targets`**（第 411 刀）：積木只認 `targets`（paramList 的 `PARAM_{i}`），
    //    以前單一名字只寫在 `obj`，於是積木上那一格是預設的 `i`
    //    ——`for c in s:` 走一趟積木回來變成 `for i in s:`，而迴圈體還在讀 `c`。從 2026-08-21 起就是這樣。
    const names = left?.type === 'identifier' ? [left]
      : left?.type === 'pattern_list' ? left.namedChildren : []
    const flat = names.length > 0 && names.every((c) => c.type === 'identifier') && !(left?.type === 'pattern_list' && names.length < 2)
    if (flat) {
      slots.targets = names.map((c) => createNode('param_decl', { type: '', name: c.text }))
      // ⚠️ `obj` 仍然填第一個名字——轉 C++ 那一路還讀它。
      properties.obj = names[0].text
    } else {
      // 🟢 **目標是一個樣式**（第 420 刀，盲測第二批 4/10 支）：`for i, (w, c) in …`、`for a, *b in …`、`for (x, y) in …`、`for x, in …`。
      //    🪦 410–419 整顆誠實降級；再之前把 `(w, c)` 安靜丟掉，Cella 對一支合法的程式報 `w` 沒定義。
      //    樣式收成運算式（元組／展開／變數——Python 的文法本來就說目標是 target list），住在 `pattern` 接點，積木換一個形態。
      //    ⚠️ 只收「名字組成的樣式」：下標與屬性目標（`for x[0] in …`）仍整顆降級——它們不綁新名字，積木的變數下拉沒有地方放。
      const pattern = left ? ctx.lift(left) : null
      if (!pattern || !isNamePattern(pattern)) return null
      slots.pattern = [pattern]
      properties.obj = firstName(pattern) ?? ''
    }

    const it = right ? ctx.lift(right) : null
    slots.iterable = it ? [it] : []
    // 迴圈體：`block` 節點由核心的 `_compound` 樣式拆開
    const liftedBody = body ? ctx.lift(body) : null
    slots.body = liftedBody
      ? (liftedBody.componentId === '_compound' ? (liftedBody.slots.body ?? []) : [liftedBody])
      : []

    // 🟢 **`for … else:` 收進 `else_body`**（第 417 刀）。
    //    🪦 2026-08-23 起整顆誠實降級；再之前那一段是**安靜地丟掉**（來回一趟之後消失，產出的碼合法）。
    //    `else:` 底下第一行的註解掛在 `else_clause` 上、排在 `block` 之前——收成那一段的第一顆。
    const alt = node.childForFieldName('alternative')
    if (alt) {
      const elseBody: SemanticNode[] = []
      for (const kid of alt.namedChildren) {
        if (kid.type !== 'comment') continue
        const made = ctx.lift(kid)
        if (made) elseBody.push(made)
      }
      const blk = alt.childForFieldName('body')
      const lifted = blk ? ctx.lift(blk) : null
      if (lifted) elseBody.push(...(lifted.componentId === '_compound' ? (lifted.slots.body ?? []) : [lifted]))
      // ⚠️ 空的 `else`（只有 `pass`）產回去就沒有 `else:`——那是另一支程式的文字，照舊整顆降級。
      if (elseBody.length === 0) return null
      slots.else_body = elseBody
    }

    return createNode('python:loop_for', properties, slots)
  })
}
