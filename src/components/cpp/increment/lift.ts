/**
 * `cpp:increment` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * ## 🪦 這裡本來也寫著「兩種形狀」
 *
 * 原文逐字：「⚠️ 兩種形狀：`i++` 與 `arr[i]++`。後者多一個 `index` 子節點。」
 *
 * **而 `++` 的運算元是一個左值，形狀是開放集合**：`o.x++`／`p->x++`／
 * `(*q)++`／`a[i][j]++`／`s[i]++` 全部合法，而它們全部被 `nameNode.text`
 * 壓進 `name` 這個字串——執行期於是去查一個叫 `o.x` 的變數。
 *
 * 🟢 2026-08-25：`name` ＋ `index` 換成**一個 `target` 接點**。
 * 見 `knowledge/concepts/左值.md`。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildIncrement(
  operator: string,
  position: string,
  target: SemanticNode | null,
): SemanticNode {
  return createNode('cpp:increment', { operator, position }, {
    target: target ? [target] : [],
  })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
