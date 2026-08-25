/**
 * `cpp:var_assign` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 *
 * 🟢 **左值是一個接點**（2026-08-25）——在此之前建構子收的是一個字串 `obj`，
 * 而語料上它裝著 12 種非原子的值（`r.x`／`p.x`…）。
 * 見 `knowledge/concepts/左值.md`。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildVarAssign(children: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:var_assign', {}, children)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
