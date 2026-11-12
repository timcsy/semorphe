/** 建構子——**讓比較鏈那顆不必寫下這顆的身分**（見同族例外分支的 `build.ts`）。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildCompareStep(operator: string, value: SemanticNode): SemanticNode {
  return createNode('python:compare_step', { operator }, { value: [value] })
}
