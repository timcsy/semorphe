/**
 * `cpp:array_at` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildArrayAt(obj: string, children: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:array_at', { obj }, children)
}

/**
 * 這顆由共用檔**呼叫**建構子，不是被問判別。
 *
 * 🪦 **「我可以被寫回」的宣告已於 2026-08-25 搬到 `execute.ts`**（見那邊的檔頭）。
 */
export function registerLift(): void {
  // 這顆沒有其他 lift 期的登記。
}
