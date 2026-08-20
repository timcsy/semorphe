import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { registerCppLiftStrategies } from '../../src/languages/cpp/core/lifters/strategies'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import type { LiftPattern } from '../../src/core/types'
import { universalComponents, universalBlocks } from '../../src/core/universal'
import { coreComponents, coreBlocks } from '../../src/languages/cpp/core'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'

/** Create a fully wired Lifter with PatternLifter + registries for testing */
export function createTestLifter(): Lifter {
  const lifter = new Lifter()

  const transformRegistry = new TransformRegistry()
  registerCoreTransforms(transformRegistry)
  const liftStrategyRegistry = new LiftStrategyRegistry()
  registerCppLiftStrategies(liftStrategyRegistry)
  const renderStrategyRegistry = new RenderStrategyRegistry()

  // Load BlockSpec patterns (for cpp_increment, cpp_var_assign_compound, etc.)
  const blockSpecRegistry = new BlockSpecRegistry()
  // ⚠️ **走唯一組裝點，不在這裡自己串一份。**
  // 這是第四份被找到的各自組裝（前三份：`component-scan.ts` 的 `allComponentDefs`、
  // `toolbox.ts` 的積木來源、以及 `all-declarations.ts` 檔頭記的那兩份）。
  // 元件膠囊接上正式路徑之後它才現形：這裡看不到膠囊，於是
  // 「`vector<int> v = f()` 的初始值被丟掉」——而那正是這個檔頭在講的那個缺陷。
  const allComponents = allCppComponents()
  const allProjections = allCppProjections()
  blockSpecRegistry.loadFromSplit(allComponents, allProjections)

  const pl = new PatternLifter()
  pl.setTransformRegistry(transformRegistry)
  pl.setLiftStrategyRegistry(liftStrategyRegistry)
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression', 'preproc_ifdef'])
  pl.loadBlockSpecs(blockSpecRegistry.getAll(), liftSkipNodeTypes)
  pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
  lifter.setPatternLifter(pl)

  registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })

  return lifter
}
