/**
 * `cpp:doc_comment` 的 **lift** 路——**pattern ＋ 建構子**
 *
 * ⚠️ **兩者不是二選一**：`lift-pattern.json` 管「這段 AST 是誰」
 * （`comment` 節點且 `startsWith('/**')`），這裡的建構子管「節點長什麼樣」。
 * 共用檔的判別策略與抽取器都呼叫它。
 */
import type { SemanticNode, PropertyValue } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildDocComment(props: Record<string, PropertyValue>): SemanticNode {
  return createNode('cpp:doc_comment', props)
}

/**
 * ⚠️ **空的，而那是顯式的。**
 *
 * 判別走 `lift-pattern.json`（glob 直讀），這裡不需要登錄任何東西。
 * 但載入器會檢查每個 `lift.ts` 都匯出 `registerLift`——
 * **少了它會在載入時丟錯，而不是靜靜失效。**
 */
export function registerLift(): void {}
