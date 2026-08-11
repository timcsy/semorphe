/**
 * `cpp:loop_count` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建loop_count(
  varName: string,
  inclusive: string | boolean,
  children: Record<string, SemanticNode[]>,
): SemanticNode {
  return createNode('cpp:loop_count', { var_name: varName, inclusive }, children)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
