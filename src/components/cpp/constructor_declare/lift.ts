/**
 * `cpp:constructor_declare` 的 **lift** 路——**一個建構子**（第 322 刀，類別外定義成員函式）。
 * 判別是 C++ 語法的知識，留在共用檔；節點的形狀是這顆元件的知識，在這裡。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildConstructorDeclare(props: Record<string, PropertyValue>, slots?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:constructor_declare', props, slots)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
