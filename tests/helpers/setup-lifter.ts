import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import type { LiftPattern } from '../../src/core/types'

/** Create a fully wired Lifter with PatternLifter + registries for testing */
export function createTestLifter(): Lifter {
  const lifter = new Lifter()

  const transformRegistry = new TransformRegistry()
  registerCoreTransforms(transformRegistry)
  const liftStrategyRegistry = new LiftStrategyRegistry()
  const renderStrategyRegistry = new RenderStrategyRegistry()

  const pl = new PatternLifter()
  pl.setTransformRegistry(transformRegistry)
  pl.setLiftStrategyRegistry(liftStrategyRegistry)
  pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
  lifter.setPatternLifter(pl)

  registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })

  return lifter
}
