import type { ConceptDefJSON, BlockProjectionJSON } from '../../../core/types'

import _coreConcepts from './concepts.json'
import _coreBlocks from './blocks.json'

/** 核心積木的 owner 標記——與 std 模組的 header 同一個名字空間 */
export const CORE_OWNER = '(core)'

export const coreConcepts = _coreConcepts as unknown as ConceptDefJSON[]

// ⚠️ 在匯出處蓋 owner 章，而不是寫進 blocks.json 的每一筆：
// 一顆積木屬於核心，是它所在的資料夾說了算。
export const coreBlocks: BlockProjectionJSON[] = (_coreBlocks as unknown as BlockProjectionJSON[]).map(
  (b) => ({ ...b, owner: CORE_OWNER }),
)

// Core generators & lifters
export { registerStatementGenerators, registerDeclarationGenerators, registerExpressionGenerators } from './generators'
export { registerStatementLifters, registerDeclarationLifters, registerExpressionLifters, registerCppLiftStrategies, registerCppTransforms } from './lifters'
