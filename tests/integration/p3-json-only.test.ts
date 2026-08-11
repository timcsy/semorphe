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
import { registerStatementGenerators } from '../../src/languages/cpp/core/generators/statements'
import type { BlockSpec, LiftPattern, StylePreset, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import type { AstNode, LiftContext } from '../../src/core/lift/types'
import { LiftContextData } from '../../src/core/lift/lift-context'

// Import split concept/projection JSON files
import { universalConcepts } from '../../src/blocks/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import { allStdModules } from '../../src/languages/cpp/std'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalConcepts ＋ coreConcepts ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppConcepts()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { componentLiftPatterns } from '../../src/core/component/lift-patterns'

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

    const allConcepts = allCppConcepts()
    registry.loadFromSplit(allConcepts, allCppProjections())
    const specs = registry.getAll()
    lifter.loadBlockSpecs(specs)
    // `lift-patterns.json` **也是 JSON**——這支測試驗的是「不寫程式碼就能加
    // 積木」，而辨識規則從 blockSpec.astPattern 搬到 lift-patterns.json 之後
    // 前提沒有變，只是來源換了一份檔案。不載入的話，這裡測的是一個生產環境
    // 不存在的組態。
    lifter.loadLiftPatterns([
    ...(liftPatternsJson as unknown as LiftPattern[]),
    // ⚠️ 膠囊自帶的 pattern 也要載——少了它，搬進膠囊的元件辨識不出來。
    ...(componentLiftPatterns() as LiftPattern[]),
  ])
    renderer.loadBlockSpecs(specs)
    extractor.loadBlockSpecs(specs)

    for (const spec of specs) {
      if (spec.codeTemplate?.pattern && spec.conceptMapping?.conceptId) {
        generator.registerTemplate(spec.conceptMapping.conceptId, spec.codeTemplate)
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

  describe('cpp_increment (update_expression)', () => {
    it('should lift i++ from AST to semantic node', () => {
      const argNode = mockNode('identifier', 'i')
      const opNode = unnamed('++', '++')
      const node = mockNode('update_expression', 'i++', [argNode, opNode], {
        argument: argNode,
      })

      const result = lifter.tryLift(node, liftCtx())
      expect(result).not.toBeNull()
      expect(result!.conceptId).toBe('cpp:increment')
      expect(result!.properties.name).toBe('i')
    })

    it('should generate code from semantic node (hand-written generator for prefix/postfix)', () => {
      const node = createNode('cpp:increment', { NAME: 'i', OP: '++' })
      const generators = new Map<string, NodeGenerator>()
      const style = { indent_size: 4, io_style: 'cout', brace_style: 'K&R' } as StylePreset
      registerStatementGenerators(generators, style)
      const ctx: GeneratorContext = { indent: 0, style, language: 'cpp', generators, templateGenerator: generator }
      const code = generateNode(node, ctx)
      expect(code).toBe('i++;\n')
    })

    it('should render semantic to block state', () => {
      const node = createNode('cpp:increment', { name: 'i', operator: '++' })
      const block = renderer.render(node)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_increment')
      expect(block!.fields.NAME).toBe('i')
      expect(block!.fields.OP).toBe('++')
    })

    it('should extract block state back to semantic', () => {
      const block = {
        type: 'cpp_increment',
        id: 'test_1',
        fields: { NAME: 'i', OP: '++' },
        inputs: {},
      }
      const node = extractor.extract(block as any)
      expect(node).not.toBeNull()
      expect(node!.conceptId).toBe('cpp:increment')
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
      expect(semantic1!.conceptId).toBe('cpp:increment')

      // Step 2: Semantic → Block (render)
      const block = renderer.render(semantic1!)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_increment')

      // Step 3: Block → Semantic (extract)
      const semantic2 = extractor.extract(block!)
      expect(semantic2).not.toBeNull()
      expect(semantic2!.conceptId).toBe('cpp:increment')
      expect(semantic2!.properties.name).toBe('i')
    })
  })

  describe('cpp_literal_char (char_literal)', () => {
    it('should lift char literal from AST', () => {
      const node = mockNode('char_literal', "'a'")
      const result = lifter.tryLift(node, liftCtx())
      expect(result).not.toBeNull()
      expect(result!.conceptId).toBe('cpp:literal_char')
      expect(result!.properties.char).toBe("'a'")
    })
  })

  describe('cpp_var_assign_compound (assignment_expression)', () => {
    it('should lift x += 5 from AST', () => {
      // Register number_literal for child lifting
      const numSpec: BlockSpec = {
        id: 'cpp_literal_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        conceptMapping: { conceptId: 'cpp:literal_number', role: 'expression' },
        blockDef: { type: 'cpp_literal_number' },
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
      expect(result!.conceptId).toBe('cpp:var_assign_compound')
      expect(result!.properties.name).toBe('x')
      expect(result!.children.value).toHaveLength(1)
      expect(result!.children.value[0].conceptId).toBe('cpp:literal_number')
    })
  })
})
