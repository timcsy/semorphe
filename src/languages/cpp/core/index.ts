import type { ConceptDefJSON, BlockProjectionJSON } from '../../../core/types'

import _coreConcepts from './concepts.json'
import _coreBlocks from './blocks.json'

export const coreConcepts = _coreConcepts as unknown as ConceptDefJSON[]
export const coreBlocks = _coreBlocks as unknown as BlockProjectionJSON[]

// Core generators & lifters
export { registerStatementGenerators, registerDeclarationGenerators, registerExpressionGenerators } from './generators'
export { registerStatementLifters, registerDeclarationLifters, registerExpressionLifters, registerCppLiftStrategies, registerCppTransforms } from './lifters'
