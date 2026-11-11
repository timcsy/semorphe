/** 建構子——見同族字面值那顆的 `build.ts` 檔頭：身分只留在自己的資料夾裡。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/** `conversion`：`''`（沒有）／`'r'`／`'s'`／`'a'`——`{x!r}` 的那個字母。 */
export function buildStringInsert(format: string, value: SemanticNode | null, conversion = ''): SemanticNode {
  return createNode('python:string_insert', { format, conversion }, value ? { value: [value] } : {})
}
