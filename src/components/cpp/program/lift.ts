/**
 * `cpp:program` 的 **lift** 路——**建構子**
 *
 * 這顆是整棵樹的根。判別走 `lift-pattern.json`（`translation_unit`）；
 * 核心與介面層要**憑空建一棵空樹**時走這個建構子。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function 建program(body: SemanticNode[] = []): SemanticNode {
  return createNode('cpp:program', {}, { body })
}

/** 判別走 pattern；這裡提供建構子。 */
export function registerLift(): void {}
