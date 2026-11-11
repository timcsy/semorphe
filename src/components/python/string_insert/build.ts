/** 建構子——見同族字面值那顆的 `build.ts` 檔頭：身分只留在自己的資料夾裡。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/**
 * `conversion`：`''`（沒有）／`'r'`／`'s'`／`'a'`——`{x!r}` 的那個字母。
 * `selfDoc`：`''`（沒有）／`'='`／`' = '`——`{x=}` 運算式後面那段（第 418 刀）。
 */
export function buildStringInsert(format: string, value: SemanticNode | null, conversion = '', selfDoc = ''): SemanticNode {
  const props: Record<string, string> = { format, conversion }
  if (selfDoc) props.selfDoc = selfDoc // 沒有的時候不寫——舊的樹與快照不必跟著變
  return createNode('python:string_insert', props, value ? { value: [value] } : {})
}
