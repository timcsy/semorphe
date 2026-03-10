import type { ConceptDefJSON, BlockProjectionJSON, StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { Lifter } from '../../../core/lift/lifter'

export interface StdModule {
  header: string
  concepts: ConceptDefJSON[]
  blocks: BlockProjectionJSON[]
  registerGenerators: (g: Map<string, NodeGenerator>, style: StylePreset) => void
  registerLifters: (lifter: Lifter) => void
}
