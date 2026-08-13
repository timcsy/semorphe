/**
 * `cpp:array_at` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { declareLvalue } from '../../../core/component/lvalue-nodes'

export function buildArrayAt(obj: string, children: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:array_at', { obj }, children)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {
  // **這種節點可以被寫回**——下標存取（`a[i]`）——容器名在 `obj` 屬性，索引在 `index` 接點。
  // 宣告在這裡而不是寫進共用檔，否則這顆元件永遠搬不動。
  declareLvalue('cpp:array_at', 'element')
}
