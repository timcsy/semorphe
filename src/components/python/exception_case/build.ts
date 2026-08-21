/** 建構子——**讓「嘗試」那顆不必寫下這顆的身分**（見同族字面值元件的 `build.ts`）。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildExceptionCase(exception: string, body: SemanticNode[], alias = ''): SemanticNode {
  return createNode('python:exception_case', { exception, alias }, { body })
}
