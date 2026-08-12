/**
 * `cpp:method_call` 的 **lift** 路
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀與「哪個名字是我」**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildMethodCall(obj: string, method: string, args: SemanticNode[]): SemanticNode {
  return createNode('cpp:method_call', { obj, method }, { args })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
