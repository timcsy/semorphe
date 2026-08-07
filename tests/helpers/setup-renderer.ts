import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { setPatternRenderer } from '../../src/core/projection/block-renderer'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { universalConcepts, universalBlocks } from '../../src/blocks/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'

/** Set up the global PatternRenderer with all block specs and render strategies */
export function setupTestRenderer(): void {
  const registry = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
  const allProjections = [
    ...universalBlocks,
    ...coreBlocks,
    ...allStdModules.flatMap(m => m.blocks),
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
