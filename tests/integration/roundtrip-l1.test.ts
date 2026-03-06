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
import type { BlockSpec, LiftPattern, UniversalTemplate } from '../../src/core/types'
import type { AstNode, LiftContext } from '../../src/core/lift/types'
import { LiftContextData } from '../../src/core/lift/lift-context'

import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'
import universalBlocks from '../../src/blocks/universal.json'
import liftPatternsJson from '../../src/languages/cpp/lift-patterns.json'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'

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

    const allSpecs = [
      ...universalBlocks as unknown as BlockSpec[],
      ...basicBlocks as unknown as BlockSpec[],
      ...specialBlocks as unknown as BlockSpec[],
    ]

    lifter.loadBlockSpecs(allSpecs)
    lifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    renderer.loadBlockSpecs(allSpecs)
    extractor.loadBlockSpecs(allSpecs)

    for (const spec of allSpecs) {
      if (spec.codeTemplate && spec.concept?.conceptId) {
        generator.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
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

  describe('c_increment — i++ / i--', () => {
    it('should lift and render i++ roundtrip', () => {
      const argNode = mockNode('identifier', 'i')
      const opNode = unnamed('++', '++')
      const ast = mockNode('update_expression', 'i++', [argNode, opNode], { argument: argNode })

      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('cpp_increment')

      const block = renderer.render(sem!)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('c_increment')

      const sem2 = extractor.extract(block!)
      expect(sem2!.concept).toBe('cpp_increment')
      expect(sem2!.properties.name).toBe('i')
    })

    it('should generate code for cpp_increment', () => {
      const node = createNode('cpp_increment', { NAME: 'j', OP: '--' })
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('j--')
    })
  })

  describe('c_char_literal', () => {
    it('should lift char_literal AST', () => {
      const ast = mockNode('char_literal', "'x'")
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('cpp_char_literal')
    })
  })

  describe('c_compound_assign — x += 5', () => {
    it('should lift assignment_expression with compound operator', () => {
      const left = mockNode('identifier', 'x')
      const op = unnamed('+=', '+=')
      const right = mockNode('number_literal', '5')
      const ast = mockNode('assignment_expression', 'x += 5', [left, op, right], {
        left, right,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('cpp_compound_assign')
      expect(sem!.properties.name).toBe('x')
      expect(sem!.children.value).toHaveLength(1)
    })
  })

  describe('c_printf / c_scanf (constrained)', () => {
    it('should lift printf call', () => {
      const funcNode = mockNode('identifier', 'printf')
      const ast = mockNode('call_expression', 'printf("%d", x)', [], {
        function: funcNode,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('cpp_printf')
    })

    it('should lift scanf call', () => {
      const funcNode = mockNode('identifier', 'scanf')
      const ast = mockNode('call_expression', 'scanf("%d", &x)', [], {
        function: funcNode,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('cpp_scanf')
    })
  })

  describe('binary_expression dispatch (arithmetic/compare/logic)', () => {
    it('should dispatch + to arithmetic', () => {
      const left = mockNode('number_literal', '3')
      const right = mockNode('number_literal', '5')
      const op = unnamed('+', '+')
      const ast = mockNode('binary_expression', '3 + 5', [left, op, right], { left, right })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('arithmetic')
      expect(sem!.properties.operator).toBe('+')
    })

    it('should dispatch > to compare', () => {
      const left = mockNode('identifier', 'x')
      const right = mockNode('number_literal', '0')
      const op = unnamed('>', '>')
      const ast = mockNode('binary_expression', 'x > 0', [left, op, right], { left, right })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('compare')
    })

    it('should dispatch && to logic', () => {
      const left = mockNode('identifier', 'a')
      const right = mockNode('identifier', 'b')
      const op = unnamed('&&', '&&')
      const ast = mockNode('binary_expression', 'a && b', [left, op, right], { left, right })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('logic')
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
      expect(sem!.concept).toBe('print')
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
      expect(sem!.concept).toBe('if')
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
      expect(sem!.concept).toBe('while_loop')
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
      expect(sem!.concept).toBe('count_loop')
    })
  })

  describe('return_statement', () => {
    it('should lift return 0', () => {
      const val = mockNode('number_literal', '0')
      const ast = mockNode('return_statement', 'return 0;', [unnamed('return', 'return'), val], {
        value: val,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('return')
      expect(sem!.children.value).toHaveLength(1)
    })
  })

  describe('break / continue', () => {
    it('should lift break_statement', () => {
      const sem = lifter.tryLift(mockNode('break_statement', 'break;'), liftCtx())
      expect(sem!.concept).toBe('break')
    })

    it('should lift continue_statement', () => {
      const sem = lifter.tryLift(mockNode('continue_statement', 'continue;'), liftCtx())
      expect(sem!.concept).toBe('continue')
    })
  })

  describe('unary_expression', () => {
    it('should lift !x to logic_not', () => {
      const arg = mockNode('identifier', 'x')
      const ast = mockNode('unary_expression', '!x', [unnamed('!', '!'), arg], {
        argument: arg,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('logic_not')
    })

    it('should lift -x to negate', () => {
      const arg = mockNode('identifier', 'x')
      const ast = mockNode('unary_expression', '-x', [unnamed('-', '-'), arg], {
        argument: arg,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('negate')
    })
  })

  describe('subscript_expression → array_access', () => {
    it('should lift arr[i]', () => {
      const arr = mockNode('identifier', 'arr')
      const idx = mockNode('identifier', 'i')
      const ast = mockNode('subscript_expression', 'arr[i]', [arr, idx], {
        argument: arr, index: idx,
      })
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('array_access')
      expect(sem!.properties.name).toBe('arr')
    })
  })

  describe('parenthesized_expression (unwrap)', () => {
    it('should unwrap (42) to number_literal', () => {
      const inner = mockNode('number_literal', '42')
      const ast = mockNode('parenthesized_expression', '(42)', [inner])
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('number_literal')
      expect(sem!.properties.value).toBe('42')
    })
  })

  describe('expression_statement (unwrap)', () => {
    it('should unwrap expression_statement to inner expression', () => {
      const inner = mockNode('number_literal', '42')
      const ast = mockNode('expression_statement', '42;', [inner])
      const sem = lifter.tryLift(ast, liftCtx())
      expect(sem!.concept).toBe('number_literal')
    })
  })

  describe('code generation for universal concepts', () => {
    it('should generate var_ref code', () => {
      const node = createNode('var_ref', { name: 'myVar' })
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('myVar')
    })

    it('should generate break code', () => {
      const node = createNode('break', {})
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('break;')
    })

    it('should generate arithmetic expression code', () => {
      const left = createNode('var_ref', { name: 'x' })
      const right = createNode('number_literal', { value: '5' })
      const node = createNode('arithmetic', { operator: '+' }, { left: [left], right: [right] })
      const code = generator.generate(node, { indent: 0, style: { indent_size: 4 } as any })
      expect(code).toBe('x + 5')
    })
  })
})
