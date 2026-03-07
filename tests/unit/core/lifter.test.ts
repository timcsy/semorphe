import { describe, it, expect, beforeAll } from 'vitest'
import { Lifter } from '../../../src/core/lift/lifter'
import type { AstNode } from '../../../src/core/lift/types'
import { createTestLifter } from '../../helpers/setup-lifter'

// Helper to create mock AST nodes
function mockNode(type: string, text: string, children: AstNode[] = [], fields: Record<string, AstNode | null> = {}): AstNode {
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

let lifter: Lifter

beforeAll(() => {
  lifter = createTestLifter()
})

describe('Lifter', () => {
  it('should lift number_literal to number_literal concept', () => {
    const node = mockNode('number_literal', '42')
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('number_literal')
    expect(result!.properties.value).toBe('42')
  })

  it('should lift identifier to var_ref concept', () => {
    const node = mockNode('identifier', 'myVar')
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('var_ref')
    expect(result!.properties.name).toBe('myVar')
  })

  it('should lift string_literal to string_literal concept', () => {
    const node = mockNode('string_literal', '"hello"')
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('string_literal')
    expect(result!.properties.value).toBe('hello')
  })

  it('should lift binary_expression with arithmetic op', () => {
    const left = mockNode('identifier', 'a')
    const right = mockNode('number_literal', '5')
    const op = unnamed('+', '+')
    const node = mockNode('binary_expression', 'a + 5', [left, op, right], {
      left, right,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('arithmetic')
    expect(result!.properties.operator).toBe('+')
    expect(result!.children.left).toHaveLength(1)
    expect(result!.children.right).toHaveLength(1)
  })

  it('should lift binary_expression with comparison op', () => {
    const left = mockNode('identifier', 'x')
    const right = mockNode('number_literal', '0')
    const op = unnamed('>=', '>=')
    const node = mockNode('binary_expression', 'x >= 0', [left, op, right], {
      left, right,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('compare')
    expect(result!.properties.operator).toBe('>=')
  })

  it('should lift binary_expression with logic op', () => {
    const left = mockNode('identifier', 'a')
    const right = mockNode('identifier', 'b')
    const op = unnamed('&&', '&&')
    const node = mockNode('binary_expression', 'a && b', [left, op, right], {
      left, right,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('logic')
    expect(result!.properties.operator).toBe('&&')
  })

  it('should lift or degrade complex template construct', () => {
    const node = mockNode('template_declaration', 'template<typename T> class Foo {};')
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    // With BlockSpec patterns loaded, template functions may be lifted instead of degraded
    expect(['raw_code', 'cpp_template_function']).toContain(result!.concept)
  })

  it('should lift translation_unit as program', () => {
    const numNode = mockNode('number_literal', '42')
    const declNode = mockNode('declaration', 'int x = 42;', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'x = 42', [
        mockNode('identifier', 'x'),
        unnamed('=', '='),
        numNode,
      ], { declarator: mockNode('identifier', 'x'), value: numNode }),
    ])
    const root = mockNode('translation_unit', 'int x = 42;', [declNode])
    const result = lifter.lift(root)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('program')
    expect(result!.children.body.length).toBeGreaterThan(0)
  })

  it('should lift return_statement', () => {
    const val = mockNode('number_literal', '0')
    const node = mockNode('return_statement', 'return 0;', [
      unnamed('return', 'return'), val, unnamed(';', ';'),
    ])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('return')
    expect(result!.children.value).toHaveLength(1)
    expect(result!.children.value[0].concept).toBe('number_literal')
  })

  it('should lift break_statement and continue_statement', () => {
    const breakNode = mockNode('break_statement', 'break;')
    const contNode = mockNode('continue_statement', 'continue;')
    expect(lifter.lift(breakNode)!.concept).toBe('break')
    expect(lifter.lift(contNode)!.concept).toBe('continue')
  })
})
