/** 建構子——**讓推導式那顆不必寫下這顆的身分**。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildLoopIter(obj: string, iterable: SemanticNode, outer: SemanticNode | null): SemanticNode {
  return createNode('python:loop_iter', { obj }, {
    iterable: [iterable],
    ...(outer ? { outer: [outer] } : {}),
  })
}
