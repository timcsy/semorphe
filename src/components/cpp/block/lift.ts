/**
 * `cpp:block` 的 **lift** 路
 *
 * ⚠️ 判別**不在這裡**——「這個 compound 是獨立的還是某個結構的 body」
 * 要看**父節點**，而那個資訊只有 `liftChildren` 的展平那一步有。
 * 見 `src/core/lift/lifter.ts` 的「Flatten _compound nodes」。
 *
 * 這裡只提供建構子，讓那一處**不必寫死身分字串**。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildBlock(body: SemanticNode[]): SemanticNode {
  return createNode('cpp:block', {}, { body })
}

export function registerLift(): void {
  // 這一路沒有自己的登錄——判別在核心的展平那一步（見檔頭）。
}
