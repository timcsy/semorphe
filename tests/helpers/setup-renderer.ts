import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { setPatternRenderer } from '../../src/core/projection/block-renderer'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { universalConcepts, universalBlocks } from '../../src/core/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'

/** Set up the global PatternRenderer with all block specs and render strategies */
export function setupTestRenderer(): void {
  const registry = new BlockSpecRegistry()
  // ⚠️ **走唯一組裝點。** 這是第七份被找到的各自組裝——少了它，
  // 已元件化的元件在完備性報表上會變成「render 缺、extract 缺」，
  // 而那顆元件的積木定義好端端地在膠囊裡。
  const allConcepts = allCppConcepts()
  const allProjections = allCppProjections()
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
