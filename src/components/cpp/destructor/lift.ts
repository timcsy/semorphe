/**
 * `cpp:destructor` 的 **lift** 路——**一個建構子**
 *
 * 判別（AST 長什麼樣、在不在類別裡）是 C++ 語法的知識，留在共用檔；
 * 節點的形狀是這顆元件的知識，在這裡。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建destructor(props: Record<string, PropertyValue>, children?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:destructor', props, children)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
