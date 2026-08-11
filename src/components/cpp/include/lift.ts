/**
 * `cpp:include` 的 **lift** 路——**建構子**
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建include(header: string, local = false): SemanticNode {
  return createNode('cpp:include', { header, local })
}

/** 判別走 pattern 與共用檔；這裡提供建構子。 */
export function registerLift(): void {}
