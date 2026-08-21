/** 建構子——見同族字面值那顆的 `build.ts` 檔頭：身分只留在自己的資料夾裡。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildStringInsert(format: string, value: SemanticNode | null): SemanticNode {
  return createNode('python:string_insert', { format }, value ? { value: [value] } : {})
}
