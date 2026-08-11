/**
 * `cpp:istringstream_declare` 的 **lift** 路——**一個建構子**
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建字串流宣告(name: string, source: SemanticNode | null): SemanticNode {
  return createNode('cpp:istringstream_declare', { name }, { source: source ? [source] : [] })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
