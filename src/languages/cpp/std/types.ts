import type { ConceptDefJSON, BlockProjectionJSON, StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { Lifter } from '../../../core/lift/lifter'
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export interface StdModule {
  header: string
  concepts: ConceptDefJSON[]
  blocks: BlockProjectionJSON[]
  registerGenerators: (g: Map<string, NodeGenerator>, style: StylePreset) => void
  registerLifters: (lifter: Lifter) => void
  /**
   * 執行那一路。**必填不是選填。**
   *
   * 選填的話，忘了接上的模組會靜靜地少一條路——那正是這個專案反覆遇到的病。
   * 沒有執行器的模組要交一個**具名**的空函式並說明原因，讓「顯式的空」與
   * 「遺漏的空」分得出來。
   */
  registerExecutors: (register: (concept: string, executor: ConceptExecutor) => void) => void
}
