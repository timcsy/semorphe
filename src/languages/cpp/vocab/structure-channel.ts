/**
 * **結構頻道**——語意樹每換一次，就把 `@cos-mos/arduino` 的動作清單推給宿主（cos-mos specs/017 的接收端 `createStructureReceiver`）。
 *
 * 規則（與 cos-mos 對過，見 `knowledge/draft/2026-11-04-cos-mos-arduino詞彙套件格式.md`）：
 * - `at` 是樹的版本，單調遞增；**同一棵樹重發不推**（骨架告示的重發帶的是同一棵——輸入沒變，不佔一個版本號）。
 * - 每份都帶 `vocab`（名＠版本）與 `contentHash`（宿主載入的套件與它不同 ⟹ 整份拒絕）。
 * - 晚訂閱的立刻拿到最後一份；回傳的函式退訂。
 * 訂的是匯流排的 `semantic:update`——「現在畫面上是哪一棵樹」唯一的答案（app 的診斷也掛在同一處）。
 */
import type { SemanticNode } from '../../../core/types'
import { buildArduinoVocab, contentHash, structureOf, type StructureMessage } from './arduino'

interface TreeBus {
  on(event: 'semantic:update', handler: (e: { tree?: SemanticNode }) => void): void
}

export interface StructureChannel {
  onStructure(cb: (m: StructureMessage) => void): () => void
  last(): StructureMessage | null
}

export async function createStructureChannel(bus: TreeBus, opts: { codeOf: (n: SemanticNode) => string }): Promise<StructureChannel> {
  const { vocab, map } = buildArduinoVocab()
  const hash = await contentHash(vocab.components)
  const listeners = new Set<(m: StructureMessage) => void>()
  let lastTree: SemanticNode | null = null
  let lastMessage: StructureMessage | null = null
  let revision = 0
  bus.on('semantic:update', (e) => {
    if (!e.tree || e.tree === lastTree) return
    lastTree = e.tree
    lastMessage = structureOf(e.tree, { vocab, map, revision: ++revision, codeOf: opts.codeOf, contentHash: hash })
    for (const cb of listeners) cb(lastMessage)
  })
  return {
    onStructure(cb) {
      listeners.add(cb)
      if (lastMessage) cb(lastMessage)
      return () => { listeners.delete(cb) }
    },
    last: () => lastMessage,
  }
}
