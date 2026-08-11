/**
 * `cpp:var_assign_compound` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * ⚠️ 兩種形狀：`x += 1` 與 `arr[i] += 1`。後者多一個 `index` 子節點。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建var_assign_compound(
  name: string,
  operator: string,
  value: SemanticNode | null,
  index?: SemanticNode | null,
): SemanticNode {
  const children: Record<string, SemanticNode[]> = { value: value ? [value] : [] }
  if (index) children.index = [index]
  return createNode('cpp:var_assign_compound', { name, operator }, children)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
