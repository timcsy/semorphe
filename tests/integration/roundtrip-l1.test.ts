/**
 * L1 Block Roundtrip Tests
 *
 * Verifies that all L1 C++ blocks (basic.json) can complete
 * AST→Semantic→Block→Semantic roundtrip conversion using only JSON definitions.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { createNode } from '../../src/core/semantic-tree'
import { generateNode, type GeneratorContext, type NodeGenerator } from '../../src/core/projection/code-generator'
import type { BlockSpec, LiftPattern, UniversalTemplate, StylePreset, ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import type { AstNode, LiftContext } from '../../src/core/lift/types'
import { LiftContextData } from '../../src/core/lift/lift-context'

import { universalConcepts, universalBlocks } from '../../src/core/universal'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalConcepts ＋ coreConcepts ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppConcepts()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { componentLiftPatterns } from '../../src/core/component/lift-patterns'
import { componentGenerateRegistrars } from '../../src/core/component/paths'

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

describe('L1 Block Roundtrip', () => {
  let lifter: PatternLifter
  let generator: TemplateGenerator
  let renderer: PatternRenderer
  let extractor: PatternExtractor

  beforeAll(() => {
    lifter = new PatternLifter()
    generator = new TemplateGenerator()
    renderer = new PatternRenderer()
    extractor = new PatternExtractor()

    const registry = new BlockSpecRegistry()
    const allConcepts = allCppConcepts()
    const allProjections = allCppProjections()
    registry.loadFromSplit(allConcepts, allProjections)
    const allSpecs = registry.getAll()

    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
    lifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    lifter.loadLiftPatterns([
    ...(liftPatternsJson as unknown as LiftPattern[]),
    // ⚠️ 膠囊自帶的 pattern 也要載——少了它，搬進膠囊的元件辨識不出來。
    ...(componentLiftPatterns() as LiftPattern[]),
  ])
    renderer.loadBlockSpecs(allSpecs)
    extractor.loadBlockSpecs(allSpecs)

    for (const spec of allSpecs) {
      if (spec.codeTemplate?.pattern && spec.conceptMapping?.conceptId) {
        generator.registerTemplate(spec.conceptMapping.conceptId, spec.codeTemplate)
      }
    }
    generator.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])
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

  describe('cpp_increment — i++ / i--', () => {
    it('should lift and render i++ roundtrip', () => {
      const argNode = mockNode('identifier', 'i')
      const opNode = unnamed('++', '++')
      const ast = mockNode('update_expression', 'i++', [argNode, opNode], { argument: argNode })

      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.conceptId).toBe('cpp:increment')

      const block = renderer.render(sem!)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('cpp_increment')

      const sem2 = extractor.extract(block!)
      expect(sem2!.conceptId).toBe('cpp:increment')
      expect(sem2!.properties.name).toBe('i')
    })

    it('should generate code for cpp_increment (hand-written generator for prefix/postfix)', () => {
      const node = createNode('cpp:increment', { NAME: 'j', OP: '--' })
      const generators = new Map<string, NodeGenerator>()
      const style = { indent_size: 4, brace_style: 'K&R' } as StylePreset
    for (const reg of componentGenerateRegistrars())
      (reg as (m: typeof generators, s: typeof style) => void)(generators, style)
      // ⚠️ **膠囊自帶的產生器也要裝。** `cpp:increment` 2026-08-11 進了膠囊，
      // 而這裡只裝共用的那一批——症狀是 `⟨unknown concept: cpp:increment⟩`，
      // 看起來像產生器不見了。第三十七條護欄講的是宣告那一維，
      // **產生器這一維是同一個病。**
      for (const reg of componentGenerateRegistrars())
        (reg as (m: typeof generators, s: typeof style) => void)(generators, style)
      const ctx: GeneratorContext = { indent: 0, style, language: 'cpp', generators, templateGenerator: generator }
      const code = generateNode(node, ctx)
      expect(code).toBe('j--;\n')
    })
  })

  describe('cpp_literal_char', () => {
    it('should lift char_literal AST', () => {
      const ast = mockNode('char_literal', "'x'")
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.conceptId).toBe('cpp:literal_char')
    })
  })

  describe('cpp_var_assign_compound — x += 5', () => {
    it('should lift assignment_expression with compound operator', () => {
      const left = mockNode('identifier', 'x')
      const op = unnamed('+=', '+=')
      const right = mockNode('number_literal', '5')
      const ast = mockNode('assignment_expression', 'x += 5', [left, op, right], {
        left, right,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.conceptId).toBe('cpp:var_assign_compound')
      expect(sem!.properties.name).toBe('x')
      expect(sem!.children.value).toHaveLength(1)
    })
  })

  describe('cpp_print_formatted / cpp_input_formatted (constrained)', () => {
    it('should skip call_expression (handled by hand-written lifter)', () => {
      // call_expression is excluded from BlockSpec pattern loading
      // because hand-written lifters convert printf→print, scanf→input
      const funcNode = mockNode('identifier', 'printf')
      const ast = mockNode('call_expression', 'printf("%d", x)', [], {
        function: funcNode,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).toBeNull() // PatternLifter yields to hand-written lifter
    })
  })

  describe('binary_expression dispatch (arithmetic/compare/logic)', () => {
    it('should dispatch + to arithmetic', () => {
      const left = mockNode('number_literal', '3')
      const right = mockNode('number_literal', '5')
      const op = unnamed('+', '+')
      const ast = mockNode('binary_expression', '3 + 5', [left, op, right], { left, right })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:arithmetic')
      expect(sem!.properties.operator).toBe('+')
    })

    it('should dispatch > to compare', () => {
      const left = mockNode('identifier', 'x')
      const right = mockNode('number_literal', '0')
      const op = unnamed('>', '>')
      const ast = mockNode('binary_expression', 'x > 0', [left, op, right], { left, right })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:compare')
    })

    it('should dispatch && to logic', () => {
      const left = mockNode('identifier', 'a')
      const right = mockNode('identifier', 'b')
      const op = unnamed('&&', '&&')
      const ast = mockNode('binary_expression', 'a && b', [left, op, right], { left, right })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:logic')
    })
  })

  describe('cout chain → print', () => {
    it('should lift cout << x << y to print', () => {
      const cout = mockNode('identifier', 'cout')
      const x = mockNode('identifier', 'x')
      const y = mockNode('identifier', 'y')
      const opShift = unnamed('<<', '<<')

      const inner = mockNode('binary_expression', 'cout << x', [cout, opShift, x], {
        left: cout, right: x,
      })
      const outer = mockNode('binary_expression', 'cout << x << y', [inner, opShift, y], {
        left: inner, right: y,
      })

      const sem = lifter.tryLift(outer, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.conceptId).toBe('cpp:print')
      expect(sem!.children.values.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('if_statement', () => {
    it('should lift if statement to if concept', () => {
      const cond = mockNode('identifier', 'x')
      const bodyStmt = mockNode('break_statement', 'break;')
      const body = mockNode('compound_statement', '{ break; }', [bodyStmt])
      const ast = mockNode('if_statement', 'if (x) { break; }', [cond, body], {
        condition: cond,
        consequence: body,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.conceptId).toBe('cpp:if')
      expect(sem!.children.then_body).toBeDefined()
    })
  })

  describe('while_statement', () => {
    it('should lift while loop', () => {
      const cond = mockNode('identifier', 'running')
      const body = mockNode('compound_statement', '{}', [])
      const ast = mockNode('while_statement', 'while (running) {}', [cond, body], {
        condition: cond, body: body,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:loop_while')
    })
  })

  describe('counting for loop → count_loop (composite)', () => {
    it('should detect counting pattern', () => {
      const iDecl = mockNode('identifier', 'i')
      const zero = mockNode('number_literal', '0')
      const initDeclarator = mockNode('init_declarator', 'i = 0', [iDecl, unnamed('=', '='), zero], {
        declarator: iDecl, value: zero,
      })
      const init = mockNode('declaration', 'int i = 0', [
        mockNode('primitive_type', 'int'), initDeclarator,
      ], { declarator: iDecl, value: zero })

      const condLeft = mockNode('identifier', 'i')
      const ten = mockNode('number_literal', '10')
      const cond = mockNode('binary_expression', 'i < 10', [condLeft, unnamed('<', '<'), ten], {
        left: condLeft, right: ten,
      })

      const update = mockNode('update_expression', 'i++', [mockNode('identifier', 'i'), unnamed('++', '++')])
      const body = mockNode('compound_statement', '{}', [])

      const ast = mockNode('for_statement', 'for (int i = 0; i < 10; i++) {}',
        [init, cond, update, body],
        { initializer: init, condition: cond, update: update, body: body },
      )
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.conceptId).toBe('cpp:loop_count')
    })
  })

  describe('return_statement', () => {
    it('should lift return 0', () => {
      const val = mockNode('number_literal', '0')
      const ast = mockNode('return_statement', 'return 0;', [unnamed('cpp:return', 'cpp:return'), val], {
        value: val,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:return')
      expect(sem!.children.value).toHaveLength(1)
    })
  })

  describe('break / continue', () => {
    it('should lift break_statement', () => {
      const sem = lifter.tryLift(mockNode('break_statement', 'break;'), liftCtx())
      expect(sem!.conceptId).toBe('cpp:break')
    })

    it('should lift continue_statement', () => {
      const sem = lifter.tryLift(mockNode('continue_statement', 'continue;'), liftCtx())
      expect(sem!.conceptId).toBe('cpp:continue')
    })
  })

  describe('unary_expression', () => {
    it('should lift !x to logic_not', () => {
      const arg = mockNode('identifier', 'x')
      const ast = mockNode('unary_expression', '!x', [unnamed('!', '!'), arg], {
        argument: arg,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:logic_not')
    })

    it('should lift -x to negate', () => {
      const arg = mockNode('identifier', 'x')
      const ast = mockNode('unary_expression', '-x', [unnamed('-', '-'), arg], {
        argument: arg,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:negate')
    })
  })

  describe('subscript_expression → array_access', () => {
    it('should skip subscript_expression (handled by hand-written lifter with fallbacks)', () => {
      // subscript_expression removed from lift-patterns.json because
      // tree-sitter C++ may not have 'index' as a named field.
      // Hand-written lifter uses namedChildren[1] fallback.
      const arr = mockNode('identifier', 'arr')
      const idx = mockNode('identifier', 'i')
      const ast = mockNode('subscript_expression', 'arr[i]', [arr, idx], {
        argument: arr, index: idx,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).toBeNull() // No pattern for subscript_expression
    })
  })

  describe('parenthesized_expression (unwrap)', () => {
    it('should unwrap (42) to number_literal', () => {
      const inner = mockNode('number_literal', '42')
      const ast = mockNode('parenthesized_expression', '(42)', [inner])
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:literal_number')
      expect(sem!.properties.value).toBe('42')
    })
  })

  describe('expression_statement (unwrap)', () => {
    it('should unwrap expression_statement to inner expression', () => {
      const inner = mockNode('number_literal', '42')
      const ast = mockNode('expression_statement', '42;', [inner])
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.conceptId).toBe('cpp:literal_number')
    })
  })

  describe('code generation for universal concepts', () => {
    it('should generate var_ref code', () => {
      const node = createNode('cpp:var_ref', { name: 'myVar' })
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('myVar')
    })

    it('should generate break code', () => {
      const node = createNode('cpp:break', {})
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('break;')
    })

    it('should generate arithmetic expression code', () => {
      const left = createNode('cpp:var_ref', { name: 'x' })
      const right = createNode('cpp:literal_number', { value: '5' })
      const node = createNode('cpp:arithmetic', { operator: '+' }, { left: [left], right: [right] })
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('x + 5')
    })
  })
})
