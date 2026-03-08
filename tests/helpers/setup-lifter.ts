import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { registerCppLiftStrategies } from '../../src/languages/cpp/lifters/strategies'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import universalBlocks from '../../src/blocks/universal.json'
import cppBasicBlocks from '../../src/languages/cpp/blocks/basic.json'
import cppSpecialBlocks from '../../src/languages/cpp/blocks/special.json'
import cppAdvancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import type { LiftPattern, BlockSpec } from '../../src/core/types'

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
  blockSpecRegistry.loadFromJSON(universalBlocks as unknown as BlockSpec[])
  blockSpecRegistry.loadFromJSON(cppBasicBlocks as unknown as BlockSpec[])
  blockSpecRegistry.loadFromJSON(cppSpecialBlocks as unknown as BlockSpec[])
  blockSpecRegistry.loadFromJSON(cppAdvancedBlocks as unknown as BlockSpec[])

  const pl = new PatternLifter()
  pl.setTransformRegistry(transformRegistry)
  pl.setLiftStrategyRegistry(liftStrategyRegistry)
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement'])
  pl.loadBlockSpecs(blockSpecRegistry.getAll(), liftSkipNodeTypes)
  pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
  lifter.setPatternLifter(pl)

  registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })

  return lifter
}
