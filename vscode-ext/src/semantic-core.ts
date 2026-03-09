import type { SemanticNode, StylePreset, LiftPattern, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { generateCode, registerLanguage, setTemplateGenerator } from '../../src/core/projection/code-generator'
import { setPatternRenderer } from '../../src/core/projection/block-renderer'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry, RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { Parser, Language } from 'web-tree-sitter'
import * as path from 'path'

// Concept JSONs
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../src/languages/cpp/semantics/concepts.json'

// Projection JSONs
import universalBlockProjections from '../../src/blocks/projections/blocks/universal-blocks.json'
import cppBasicProjections from '../../src/languages/cpp/projections/blocks/basic.json'
import cppSpecialProjections from '../../src/languages/cpp/projections/blocks/special.json'
import cppAdvancedProjections from '../../src/languages/cpp/projections/blocks/advanced.json'
import cppStdlibContainers from '../../src/languages/cpp/projections/blocks/stdlib-containers.json'
import cppStdlibAlgorithms from '../../src/languages/cpp/projections/blocks/stdlib-algorithms.json'

// Lift patterns
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'

// Style presets
import apcsPreset from '../../src/languages/cpp/styles/apcs.json'

const SKIP_NODE_TYPES = new Set([
  'call_expression', 'using_declaration', 'for_statement',
  'assignment_expression', 'update_expression', 'switch_statement',
  'case_statement', 'do_statement', 'conditional_expression', 'cast_expression',
])

export class SemanticCore {
  private tsParser: Parser | null = null
  private lifter: Lifter | null = null
  private blockSpecRegistry: BlockSpecRegistry
  private patternRenderer: PatternRenderer | null = null
  private patternExtractor: PatternExtractor | null = null
  private currentStyle: StylePreset = apcsPreset as StylePreset

  constructor() {
    this.blockSpecRegistry = new BlockSpecRegistry()
  }

  async init(wasmDir: string): Promise<void> {
    // 1. Register C++ generators
    registerCppLanguage()

    // 2. Load block specs
    const allConcepts = [
      ...universalConcepts as unknown as ConceptDefJSON[],
      ...cppConcepts as unknown as ConceptDefJSON[],
    ]
    const allProjections = [
      ...universalBlockProjections as unknown as BlockProjectionJSON[],
      ...cppBasicProjections as unknown as BlockProjectionJSON[],
      ...cppSpecialProjections as unknown as BlockProjectionJSON[],
      ...cppAdvancedProjections as unknown as BlockProjectionJSON[],
      ...cppStdlibContainers as unknown as BlockProjectionJSON[],
      ...cppStdlibAlgorithms as unknown as BlockProjectionJSON[],
    ]
    this.blockSpecRegistry.loadFromSplit(allConcepts, allProjections)
    const allSpecs = this.blockSpecRegistry.getAll()

    // 3. Setup lift pipeline
    const lifter = new Lifter()
    const transformRegistry = new TransformRegistry()
    registerCoreTransforms(transformRegistry)
    const liftStrategyRegistry = new LiftStrategyRegistry()
    const renderStrategyRegistry = new RenderStrategyRegistry()

    const pl = new PatternLifter()
    pl.setTransformRegistry(transformRegistry)
    pl.setLiftStrategyRegistry(liftStrategyRegistry)
    pl.loadBlockSpecs(allSpecs, SKIP_NODE_TYPES)
    pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(pl)

    const pr = new PatternRenderer()
    pr.setRenderStrategyRegistry(renderStrategyRegistry)
    pr.loadBlockSpecs(allSpecs)
    setPatternRenderer(pr)
    this.patternRenderer = pr

    const pe = new PatternExtractor()
    pe.loadBlockSpecs(allSpecs)
    this.patternExtractor = pe

    registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })
    this.lifter = lifter

    // 4. Init tree-sitter (external module, not bundled by esbuild)
    await Parser.init({
      locateFile: (scriptName: string) => path.join(wasmDir, scriptName),
    })

    const parser = new Parser()
    const langWasm = path.join(wasmDir, 'tree-sitter-cpp.wasm')
    const language = await Language.load(langWasm)
    parser.setLanguage(language)
    this.tsParser = parser
  }

  async lift(code: string): Promise<SemanticNode | null> {
    if (!this.tsParser || !this.lifter) return null
    const tree = this.tsParser.parse(code)
    return this.lifter.lift(tree.rootNode as any)
  }

  generate(tree: SemanticNode): string {
    return generateCode(tree, 'cpp', this.currentStyle)
  }

  getBlockSpecRegistry(): BlockSpecRegistry {
    return this.blockSpecRegistry
  }

  getPatternRenderer(): PatternRenderer | null {
    return this.patternRenderer
  }

  getPatternExtractor(): PatternExtractor | null {
    return this.patternExtractor
  }

  setStyle(style: StylePreset): void {
    this.currentStyle = style
  }
}
