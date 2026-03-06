import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { setPatternRenderer } from '../../src/core/projection/block-renderer'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import type { BlockSpec } from '../../src/core/types'
import universalBlocks from '../../src/blocks/universal.json'
import cppBasicBlocks from '../../src/languages/cpp/blocks/basic.json'
import cppSpecialBlocks from '../../src/languages/cpp/blocks/special.json'
import cppAdvancedBlocks from '../../src/languages/cpp/blocks/advanced.json'

/** Set up the global PatternRenderer with all block specs and render strategies */
export function setupTestRenderer(): void {
  const registry = new BlockSpecRegistry()
  registry.loadFromJSON(universalBlocks as unknown as BlockSpec[])
  registry.loadFromJSON(cppBasicBlocks as unknown as BlockSpec[])
  registry.loadFromJSON(cppSpecialBlocks as unknown as BlockSpec[])
  registry.loadFromJSON(cppAdvancedBlocks as unknown as BlockSpec[])

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
