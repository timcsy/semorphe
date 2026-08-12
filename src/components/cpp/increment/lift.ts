/**
 * `cpp:increment` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * ⚠️ 兩種形狀：`i++` 與 `arr[i]++`。後者多一個 `index` 子節點。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildIncrement(
  name: string,
  operator: string,
  position: string,
  index?: SemanticNode | null,
): SemanticNode {
  return index
    ? createNode('cpp:increment', { name, operator, position }, { index: [index] })
    : createNode('cpp:increment', { name, operator, position })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
