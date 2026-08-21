/**
 * 建構子——**讓需要主動降級的人不必寫下這顆的身分**。
 *
 * 🔴 誰會需要：一個 lift 策略認出「這是我的形狀，而我表達不了它」時，
 * 回 `null` 會讓比對迴圈落到別筆樣式，而那一筆可能**只做到一半**
 * （同族的串接比較就是這樣被砍掉後半段的）。**主動變灰才說得出口。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildRawExpression(code: string): SemanticNode {
  return createNode('python:raw_expression', { code }, {})
}
