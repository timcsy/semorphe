/**
 * `cpp:case` 的 **lift** 路——**一個建構子**
 *
 * 共用檔只有一處建立這顆元件。那一處的**判別**（AST 節點長什麼樣）是
 * C++ 語法的知識，留在共用檔；**節點的形狀**是這顆元件的知識，搬到這裡。
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildCase(value: SemanticNode | null, body: SemanticNode[]): SemanticNode {
  return createNode('cpp:case', {}, { value: value ? [value] : [], body })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
