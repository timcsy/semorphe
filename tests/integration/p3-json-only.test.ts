/**
 * P3 Verification: Pure JSON block roundtrip conversion.
 *
 * This test proves that a block defined ONLY in JSON (no hand-written TypeScript)
 * can complete the full four-direction conversion cycle:
 *   Block → Semantic → Code → AST → Semantic → Block
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { createNode } from '../../src/core/semantic-tree'
import { generateNode, type GeneratorContext, type NodeGenerator } from '../../src/core/projection/code-generator'
import { registerStatementGenerators } from '../../src/languages/cpp/generators/statements'
import type { BlockSpec, LiftPattern, StylePreset, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import type { AstNode, LiftContext } from '../../src/core/lift/types'
import { LiftContextData } from '../../src/core/lift/lift-context'

// Import split concept/projection JSON files
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'

// Mock AST node helper
function mockNode(
  type: string,
  text: string,
  children: AstNode[] = [],
  fields: Record<string, AstNode | null> = {},
): AstNode {
  const namedChildren = children.filter(c => c.isNamed)
  return {
    type,
    text,
    isNamed: true,
    children,
    namedChildren,
    childForFieldName: (name: string) => fields[name] ?? null,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
  }
}

function unnamed(type: string, text: string): AstNode {
  return { ...mockNode(type, text), isNamed: false }
}

describe('P3 Verification: Pure JSON Block Roundtrip', () => {
  let registry: BlockSpecRegistry
  let lifter: PatternLifter
  let generator: TemplateGenerator
  let renderer: PatternRenderer
  let extractor: PatternExtractor

  beforeAll(() => {
    registry = new BlockSpecRegistry()
    lifter = new PatternLifter()
    generator = new TemplateGenerator()
    renderer = new PatternRenderer()
    extractor = new PatternExtractor()

    const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
    registry.loadFromSplit(allConcepts, [...coreBlocks, ...allStdModules.flatMap(m => m.blocks)])
    const specs = registry.getAll()
    lifter.loadBlockSpecs(specs)
    renderer.loadBlockSpecs(specs)
    extractor.loadBlockSpecs(specs)

    for (const spec of specs) {
      if (spec.codeTemplate?.pattern && spec.concept?.conceptId) {
        generator.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
      }
    }
  })

  function liftCtx(): LiftContext {
    const data = new LiftContextData()
    return {
      lift: (n) => lifter.tryLift(n, liftCtx()),
      liftChildren: (nodes) =>
        nodes.map(n => lifter.tryLift(n, liftCtx())).filter((r): r is NonNullable<typeof r> => r !== null),
      data,
    }
  }

  describe('c_increment (update_expression)', () => {
    it('should lift i++ from AST to semantic node', () => {
      const argNode = mockNode('identifier', 'i')
      const opNode = unnamed('++', '++')
      const node = mockNode('update_expression', 'i++', [argNode, opNode], {
        argument: argNode,
      })

      const result = lifter.tryLift(node, liftCtx())
      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_increment')
      expect(result!.properties.name).toBe('i')
    })

    it('should generate code from semantic node (hand-written generator for prefix/postfix)', () => {
      const node = createNode('cpp_increment', { NAME: 'i', OP: '++' })
      const generators = new Map<string, NodeGenerator>()
      const style = { indent_size: 4, io_style: 'cout', brace_style: 'K&R' } as StylePreset
      registerStatementGenerators(generators, style)
      const ctx: GeneratorContext = { indent: 0, style, language: 'cpp', generators, templateGenerator: generator }
      const code = generateNode(node, ctx)
      expect(code).toBe('i++;\n')
    })

    it('should render semantic to block state', () => {
      const node = createNode('cpp_increment', { name: 'i', operator: '++' })
      const block = renderer.render(node)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_increment')
      expect(block!.fields.NAME).toBe('i')
      expect(block!.fields.OP).toBe('++')
    })

    it('should extract block state back to semantic', () => {
      const block = {
        type: 'c_increment',
        id: 'test_1',
        fields: { NAME: 'i', OP: '++' },
        inputs: {},
      }
      const node = extractor.extract(block as any)
      expect(node).not.toBeNull()
      expect(node!.concept).toBe('cpp_increment')
      expect(node!.properties.name).toBe('i')
      expect(node!.properties.operator).toBe('++')
    })

    it('should complete full AST→Semantic→Block→Semantic roundtrip', () => {
      // Step 1: AST → Semantic (lift)
      const argNode = mockNode('identifier', 'i')
      const opNode = unnamed('++', '++')
      const astNode = mockNode('update_expression', 'i++', [argNode, opNode], {
        argument: argNode,
      })
      const semantic1 = lifter.tryLift(astNode, liftCtx())
      expect(semantic1).not.toBeNull()
      expect(semantic1!.concept).toBe('cpp_increment')

      // Step 2: Semantic → Block (render)
      const block = renderer.render(semantic1!)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_increment')

      // Step 3: Block → Semantic (extract)
      const semantic2 = extractor.extract(block!)
      expect(semantic2).not.toBeNull()
      expect(semantic2!.concept).toBe('cpp_increment')
      expect(semantic2!.properties.name).toBe('i')
    })
  })

  describe('c_char_literal (char_literal)', () => {
    it('should lift char literal from AST', () => {
      const node = mockNode('char_literal', "'a'")
      const result = lifter.tryLift(node, liftCtx())
      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_char_literal')
      expect(result!.properties.char).toBe("'a'")
    })
  })

  describe('c_compound_assign (assignment_expression)', () => {
    it('should lift x += 5 from AST', () => {
      // Register number_literal for child lifting
      const numSpec: BlockSpec = {
        id: 'u_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'number_literal', role: 'expression' },
        blockDef: { type: 'u_number' },
        codeTemplate: { pattern: '${value}', imports: [], order: 20 },
        astPattern: {
          nodeType: 'number_literal',
          constraints: [],
          fieldMappings: [{ semantic: 'value', ast: '$text', extract: 'text' }],
        },
      }
      lifter.loadBlockSpecs([numSpec])

      const leftNode = mockNode('identifier', 'x')
      const opNode = unnamed('+=', '+=')
      const rightNode = mockNode('number_literal', '5')
      const node = mockNode('assignment_expression', 'x += 5', [leftNode, opNode, rightNode], {
        left: leftNode,
        right: rightNode,
      })

      const result = lifter.tryLift(node, liftCtx())
      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_compound_assign')
      expect(result!.properties.name).toBe('x')
      expect(result!.children.value).toHaveLength(1)
      expect(result!.children.value[0].concept).toBe('number_literal')
    })
  })
})
