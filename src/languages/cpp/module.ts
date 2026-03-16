/**
 * C++ Language Module
 *
 * Central initialization for the JSON-driven conversion pipeline.
 * Loads concept definitions (semantic layer) and block projections (projection layer)
 * directly into registries, then wires into the four generic engines.
 */
import type { LiftPattern, UniversalTemplate, ConceptDefJSON, BlockProjectionJSON } from '../../core/types'
import { BlockSpecRegistry } from '../../core/block-spec-registry'
import { ConceptRegistry } from '../../core/concept-registry'
import { PatternLifter } from '../../core/lift/pattern-lifter'
import { TemplateGenerator } from '../../core/projection/template-generator'
import { PatternRenderer } from '../../core/projection/pattern-renderer'
import { PatternExtractor } from '../../core/projection/pattern-extractor'

// Semantic layer: concept definitions
import universalConcepts from '../../blocks/semantics/universal-concepts.json'
import { coreConcepts } from './core'
import { allStdModules } from './std'

// Projection layer: block definitions
import universalBlocks from '../../blocks/projections/blocks/universal-blocks.json'
import { coreBlocks } from './core'

// Other resources
import liftPatternsJson from './lift-patterns.json'
import universalTemplatesJson from './templates/universal-templates.json'

export interface CppModuleEngines {
  registry: BlockSpecRegistry
  conceptRegistry: ConceptRegistry
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
  const conceptRegistry = new ConceptRegistry()
  const patternLifter = new PatternLifter()
  const templateGenerator = new TemplateGenerator()
  const patternRenderer = new PatternRenderer()
  const patternExtractor = new PatternExtractor()

  // 1. Load concepts into ConceptRegistry (semantic layer, independent of Blockly)
  const allConcepts: ConceptDefJSON[] = [
    ...universalConcepts as unknown as ConceptDefJSON[],
    ...coreConcepts,
    ...allStdModules.flatMap(m => m.concepts),
  ]
  conceptRegistry.loadFromJSON(allConcepts)

  // 2. Load split JSON directly into registry
  const allProjections: BlockProjectionJSON[] = [
    ...universalBlocks as unknown as BlockProjectionJSON[],
    ...coreBlocks,
    ...allStdModules.flatMap(m => m.blocks),
  ]
  registry.loadFromSplit(allConcepts, allProjections)
  const allSpecs = registry.getAll()

  // 3. Load block specs into engines
  const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration', 'for_statement', 'assignment_expression', 'update_expression', 'switch_statement', 'case_statement', 'do_statement', 'conditional_expression', 'cast_expression', 'preproc_ifdef'])
  patternLifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
  patternRenderer.loadBlockSpecs(allSpecs)
  patternExtractor.loadBlockSpecs(allSpecs)

  // 4. Load lift patterns
  patternLifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])

  // 5. Load universal templates
  templateGenerator.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])

  // 6. Register code templates from block specs
  for (const spec of allSpecs) {
    if (spec.codeTemplate && spec.concept?.conceptId) {
      templateGenerator.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
    }
  }

  return { registry, conceptRegistry, patternLifter, templateGenerator, patternRenderer, patternExtractor }
}
