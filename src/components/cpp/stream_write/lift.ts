/**
 * `cpp:stream_write` 的 **lift** 路——一個建構子。
 * 判別（根變數宣告成 ostream）要查辨識脈絡，留在讀取那一半旁邊的後處理。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildStreamWrite(stream: SemanticNode, values: SemanticNode[]): SemanticNode {
  return createNode('cpp:stream_write', {}, { stream: [stream], values })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
