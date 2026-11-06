/**
 * `cpp:method_declare` 的 **lift** 路——**一個建構子**（第 322 刀）。
 * 判別（類別裡的 field_declaration、宣告子是函式、形狀單純）是 C++ 語法的知識，留在共用檔 `liftClassMember`。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildMethodDeclare(props: Record<string, PropertyValue>, slots?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:method_declare', props, slots)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
