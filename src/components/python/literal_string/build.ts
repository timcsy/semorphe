/**
 * 建構子——**讓別人不必寫下這顆的身分**。
 *
 * 格式化文字的策略要把每一段字面片段做成節點，而它若直接寫
 * `createNode('python:literal_string', …)`，那個身分字串就出現在別人的資料夾裡
 * ——就近性護欄**兩個方向都會報**，而它報的是對的：
 *
 * > **身分只留在膠囊裡一處，否則這顆改名時，別人那一份不會有人發現。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildLiteralString(value: string): SemanticNode {
  return createNode('python:literal_string', { value }, {})
}
