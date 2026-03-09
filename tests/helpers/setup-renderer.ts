import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { setPatternRenderer } from '../../src/core/projection/block-renderer'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../src/languages/cpp/semantics/concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import cppBasicBlocks from '../../src/languages/cpp/projections/blocks/basic.json'
import cppSpecialBlocks from '../../src/languages/cpp/projections/blocks/special.json'
import cppAdvancedBlocks from '../../src/languages/cpp/projections/blocks/advanced.json'

/** Set up the global PatternRenderer with all block specs and render strategies */
export function setupTestRenderer(): void {
  const registry = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
  const allProjections = [
    ...universalBlocks as unknown as BlockProjectionJSON[],
    ...cppBasicBlocks as unknown as BlockProjectionJSON[],
    ...cppSpecialBlocks as unknown as BlockProjectionJSON[],
    ...cppAdvancedBlocks as unknown as BlockProjectionJSON[],
  ]
  registry.loadFromSplit(allConcepts, allProjections)

  const renderStrategyRegistry = new RenderStrategyRegistry()
  registerCppRenderStrategies(renderStrategyRegistry)

  const pr = new PatternRenderer()
  pr.setRenderStrategyRegistry(renderStrategyRegistry)
  pr.loadBlockSpecs(registry.getAll())
  setPatternRenderer(pr)
}

/** Clear the global PatternRenderer */
export function clearTestRenderer(): void {
  setPatternRenderer(null as any)
}
