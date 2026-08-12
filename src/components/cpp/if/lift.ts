/**
 * `cpp:if` 的 **lift** 路——**建構子**
 *
 * 判別走 `lift-pattern.json`；抽取器要直接建一顆 if（積木還原成語義樹）時
 * 走這個建構子。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildIf(children: Record<string, SemanticNode[]>, isElseIf = false): SemanticNode {
  return isElseIf
    ? createNode('cpp:if', { isElseIf: 'true' }, children)
    : createNode('cpp:if', {}, children)
}

/** 判別走 pattern；這裡只提供建構子。 */
export function registerLift(): void {}
