import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { registerCppLiftStrategies } from '../../src/languages/cpp/lifters/strategies'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import type { LiftPattern, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../src/languages/cpp/semantics/concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import cppBasicBlocks from '../../src/languages/cpp/projections/blocks/basic.json'
import cppSpecialBlocks from '../../src/languages/cpp/projections/blocks/special.json'
import cppAdvancedBlocks from '../../src/languages/cpp/projections/blocks/advanced.json'

/** Create a fully wired Lifter with PatternLifter + registries for testing */
export function createTestLifter(): Lifter {
  const lifter = new Lifter()

  const transformRegistry = new TransformRegistry()
  registerCoreTransforms(transformRegistry)
  const liftStrategyRegistry = new LiftStrategyRegistry()
  registerCppLiftStrategies(liftStrategyRegistry)
  const renderStrategyRegistry = new RenderStrategyRegistry()

  // Load BlockSpec patterns (for c_increment, c_compound_assign, etc.)
  const blockSpecRegistry = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
  const allProjections = [
    ...universalBlocks as unknown as BlockProjectionJSON[],
    ...cppBasicBlocks as unknown as BlockProjectionJSON[],
    ...cppSpecialBlocks as unknown as BlockProjectionJSON[],
    ...cppAdvancedBlocks as unknown as BlockProjectionJSON[],
  ]
  blockSpecRegistry.loadFromSplit(allConcepts, allProjections)

  const pl = new PatternLifter()
  pl.setTransformRegistry(transformRegistry)
  pl.setLiftStrategyRegistry(liftStrategyRegistry)
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression'])
  pl.loadBlockSpecs(blockSpecRegistry.getAll(), liftSkipNodeTypes)
  pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
  lifter.setPatternLifter(pl)

  registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })

  return lifter
}
