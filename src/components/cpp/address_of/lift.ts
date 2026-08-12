/**
 * `cpp:address_of` 的 **lift** 路
 *
 * 「這是不是 `unary_expression`」是 C++ 語法的知識，留在共用檔；
 * **「`&` 這個符號是我」與節點的形狀**是這顆元件的知識，在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildAddressOf(operand: SemanticNode | null): SemanticNode {
  return createNode('cpp:address_of', {}, { var: operand ? [operand] : [] })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
