/**
 * C++ Language Module
 *
 * Central initialization for the JSON-driven conversion pipeline.
 * Loads all BlockSpecs, LiftPatterns, and UniversalTemplates,
 * then wires them into the four generic engines.
 */
import type { BlockSpec, LiftPattern, UniversalTemplate } from '../../core/types'
import { BlockSpecRegistry } from '../../core/block-spec-registry'
import { PatternLifter } from '../../core/lift/pattern-lifter'
import { TemplateGenerator } from '../../core/projection/template-generator'
import { PatternRenderer } from '../../core/projection/pattern-renderer'
import { PatternExtractor } from '../../core/projection/pattern-extractor'

// Import JSON block definitions
import universalBlocks from '../../blocks/universal.json'
import basicBlocks from './blocks/basic.json'
import advancedBlocks from './blocks/advanced.json'
import specialBlocks from './blocks/special.json'
import liftPatternsJson from './lift-patterns.json'
import universalTemplatesJson from './templates/universal-templates.json'

export interface CppModuleEngines {
  registry: BlockSpecRegistry
  patternLifter: PatternLifter
  templateGenerator: TemplateGenerator
  patternRenderer: PatternRenderer
  patternExtractor: PatternExtractor
}

/**
 * Initialize the C++ language module with all four engines.
 * Returns the initialized engines for wiring into the app.
 */
export function initCppModule(): CppModuleEngines {
  const registry = new BlockSpecRegistry()
  const patternLifter = new PatternLifter()
  const templateGenerator = new TemplateGenerator()
  const patternRenderer = new PatternRenderer()
  const patternExtractor = new PatternExtractor()

  // 1. Load all block specs into registry
  const allSpecs = [
    ...universalBlocks as unknown as BlockSpec[],
    ...basicBlocks as unknown as BlockSpec[],
    ...advancedBlocks as unknown as BlockSpec[],
    ...specialBlocks as unknown as BlockSpec[],
  ]
  registry.loadFromJSON(allSpecs)

  // 2. Load block specs into engines
  // Skip call_expression and using_declaration — hand-written lifters handle these better
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement'])
  patternLifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
  patternRenderer.loadBlockSpecs(allSpecs)
  patternExtractor.loadBlockSpecs(allSpecs)

  // 3. Load lift patterns
  const liftPatterns = liftPatternsJson as unknown as LiftPattern[]
  patternLifter.loadLiftPatterns(liftPatterns)

  // 4. Load universal templates
  const universalTemplates = universalTemplatesJson as unknown as UniversalTemplate[]
  templateGenerator.loadUniversalTemplates(universalTemplates)

  // 5. Register code templates from block specs
  for (const spec of allSpecs) {
    if (spec.codeTemplate && spec.concept?.conceptId) {
      templateGenerator.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
    }
  }

  return {
    registry,
    patternLifter,
    templateGenerator,
    patternRenderer,
    patternExtractor,
  }
}
