/**
 * `cpp:initializer_list` 的 **lift** 路——判別在共用檔，這裡提供建構子。
 *
 * ⚠️ 兩個地方會造它，而它們看到的東西不同：
 *   `attachInitializer`（陣列宣告）  直接從 AST 拆，比 lifter 早
 *   `expressions.ts` 的 lifter      表達式位置的 `{…}`（`P a{3}`、`push_back({2,1})`）
 *
 * **同一顆元件在兩處被建立，該收的不是分支，是建構子**（與 `array_declare` 同一條）。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { declareAggregateList } from '../../../core/component/aggregate-nodes'

export function buildInitializerList(values: SemanticNode[]): SemanticNode {
  return createNode('cpp:initializer_list', {}, { values })
}

/** 判別走共用檔；這裡提供建構子 ＋ 自己宣告「我是一層 `{…}`」。 */
export function registerLift(): void {
  // 消費它的 `interpreter/aggregate.ts` 住在核心，而這個名字是 C++ 的知識
  // ——**問角色，不問身分**。
  declareAggregateList('cpp:initializer_list')
}
