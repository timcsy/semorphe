/**
 * `cpp:define` 的 **lift** 路
 *
 * 判別（AST 節點長什麼樣）是 C++ 語法的知識，留在共用檔；
 * **節點的形狀與「哪個名字是我」**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建define(name: string, value: string): SemanticNode {
  return createNode('cpp:define', { name, value })
}

/** 判別走 `lift-pattern.json`；這裡只提供建構子給共用檔呼叫。 */
export function registerLift(): void {}
