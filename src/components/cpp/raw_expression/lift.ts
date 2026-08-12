/**
 * `cpp:raw_expression` 的 **lift** 路——**一個建構子**
 *
 * 共用檔只有一處建立這顆元件。那一處的**判別**（AST 節點長什麼樣）是
 * C++ 語法的知識，留在共用檔；**節點的形狀**是這顆元件的知識，搬到這裡。
 *
 * > **判別與建構屬於元件；語法的解析屬於語言。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/**
 * ⚠️ 這顆是 **for 迴圈三格的兜底**：`canBeForLoopPart` 說不行的東西，
 * 就被包成一段原始字串。它不是使用者選的積木，是**辨識失敗的落點**。
 */
export function buildRawExpression(code: string): SemanticNode {
  return createNode('cpp:raw_expression', { code })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
