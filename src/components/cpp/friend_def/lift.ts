/**
 * `cpp:friend_def` 的 **lift** 路——一個建構子（第 394 刀）。
 * 判別（類別本體裡的 friend_declaration、形狀單純、帶本體）是 C++ 語法的知識，留在共用檔 `liftClassMember`。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildFriendDef(props: Record<string, PropertyValue>, slots?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:friend_def', props, slots)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
