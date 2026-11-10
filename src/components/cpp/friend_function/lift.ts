/**
 * `cpp:friend_function` 的 **lift** 路——一個建構子（第 389 刀）。
 * 判別（類別本體裡的 friend_declaration、只有原型、形狀單純）是 C++ 語法的知識，留在共用檔 `liftClassMember`。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildFriendFunction(props: Record<string, PropertyValue>, slots?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:friend_function', props, slots)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
