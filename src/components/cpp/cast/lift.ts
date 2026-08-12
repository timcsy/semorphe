/**
 * `cpp:cast` 的 **lift** 路——**一個建構子**
 *
 * C 風格轉型的判別與 `malloc` 綁在同一個策略裡（`(int*)malloc(...)`），
 * 那是 C++ 語法的知識，留在共用檔。節點的形狀在這裡。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildCast(targetType: string, value: SemanticNode | null): SemanticNode {
  return createNode('cpp:cast', { target_type: targetType }, { value: value ? [value] : [] })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
