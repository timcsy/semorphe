/**
 * `cpp:var_assign_compound` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * ## 🪦 這裡本來有「兩種形狀」
 *
 * 原本的註解逐字：「⚠️ 兩種形狀：`x += 1` 與 `arr[i] += 1`。後者多一個 `index` 子節點。」
 *
 * **而左值不只兩種**：`o.x`／`p->x`／`*q`／`a[i][j]`／`a.b.c` 全部合法，
 * 而它們全部被 `left.text` 壓進 `name` 這個字串——`x += 1` 之外的每一種
 * 在執行期都會查一個不存在的變數名。
 *
 * 🟢 2026-08-25：`name` ＋ `index` 換成**一個 `target` 接點**，
 * 於是這裡不再需要知道左邊長什麼樣——`ctx.lift(left)` 就對了。
 * 見 `knowledge/concepts/左值.md`。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildVarAssignCompound(
  operator: string,
  value: SemanticNode | null,
  target: SemanticNode | null,
): SemanticNode {
  return createNode('cpp:var_assign_compound', { operator }, {
    target: target ? [target] : [],
    value: value ? [value] : [],
  })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
