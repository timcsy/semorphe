/**
 * `cpp:method_def` 的 **lift** 路——**一個建構子**（第 218 刀）
 *
 * 判別（AST 長什麼樣、在不在類別裡、尾端有沒有 const）是 C++ 語法的知識，留在共用檔；
 * 節點的形狀是這顆元件的知識，在這裡。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildMethodDef(props: Record<string, PropertyValue>, slots?: Record<string, SemanticNode[]>): SemanticNode {
  return createNode('cpp:method_def', props, slots)
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
