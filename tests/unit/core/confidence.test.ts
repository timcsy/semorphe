/**
 * Confidence & DegradationCause 一致性測試
 */
import { describe, it, expect } from 'vitest'
import { Lifter } from '../../../src/core/lift/lifter'
import { PatternLifter } from '../../../src/core/lift/pattern-lifter'
import { ConceptRegistry } from '../../../src/core/concept-registry'
import { createNode } from '../../../src/core/semantic-tree'
import { LiftContextData } from '../../../src/core/lift/lift-context'
import type { AstNode, LiftContext } from '../../../src/core/lift/types'
import { registerExpressionLifters } from '../../../src/languages/cpp/lifters/expressions'
import type { BlockSpec, LiftPattern, ConceptDefJSON, BlockProjectionJSON } from '../../../src/core/types'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'

import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../../src/languages/cpp/semantics/concepts.json'
import basicBlocks from '../../../src/languages/cpp/projections/blocks/basic.json'
import specialBlocks from '../../../src/languages/cpp/projections/blocks/special.json'
import universalBlocks from '../../../src/blocks/projections/blocks/universal-blocks.json'
import liftPatternsJson from '../../../src/languages/cpp/lift-patterns.json'

function mockNode(
  type: string,
  text: string,
  children: AstNode[] = [],
  fields: Record<string, AstNode | null> = {},
  hasError = false,
): AstNode {
  const namedChildren = children.filter(c => c.isNamed)
  return {
    type: hasError ? 'ERROR' : type,
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

describe('Confidence & DegradationCause', () => {
  let lifter: Lifter
  let patternLifter: PatternLifter
  let registry: ConceptRegistry

  function setup() {
    lifter = new Lifter()
    patternLifter = new PatternLifter()
    registry = new ConceptRegistry()

    const specRegistry = new BlockSpecRegistry()
    const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
    const allProjections = [
      ...universalBlocks as unknown as BlockProjectionJSON[],
      ...basicBlocks as unknown as BlockProjectionJSON[],
      ...specialBlocks as unknown as BlockProjectionJSON[],
    ]
    specRegistry.loadFromSplit(allConcepts, allProjections)
    const allSpecs = specRegistry.getAll()

    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
    patternLifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    patternLifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(patternLifter)

    // Register known concept IDs in ConceptRegistry
    for (const spec of allSpecs) {
      const conceptId = (spec as BlockSpec).concept?.conceptId
      if (conceptId && !registry.get(conceptId)) {
        registry.register({
          id: conceptId,
          layer: 'universal',
          level: 0,
          propertyNames: [],
          childNames: [],
        })
      }
    }

    // Register hand-written lifters for expressions
    registerExpressionLifters(lifter)
  }

  function liftCtx(): LiftContext {
    const data = new LiftContextData()
    return {
      lift: (n) => lifter.liftWithContext(n, data),
      liftChildren: (nodes) =>
        nodes.map(n => lifter.liftWithContext(n, data)).filter((r): r is NonNullable<typeof r> => r !== null),
      data,
    }
  }

  describe('精確 pattern match → confidence: high', () => {
    it('should set confidence to high for number_literal', () => {
      setup()
      const ast = mockNode('number_literal', '42')
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      expect(sem!.metadata?.confidence).toBe('high')
    })

    it('should set confidence to high for binary_expression', () => {
      setup()
      const left = mockNode('number_literal', '3')
      const right = mockNode('number_literal', '5')
      const op = unnamed('+', '+')
      const ast = mockNode('binary_expression', '3 + 5', [left, op, right], { left, right })
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      expect(sem!.metadata?.confidence).toBe('high')
    })
  })

  describe('tree-sitter ERROR → raw_code + syntax_error', () => {
    it('should set degradationCause to syntax_error for ERROR nodes', () => {
      setup()
      const ast = mockNode('ERROR', 'int x = ;', [], {}, true)
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('raw_code')
      expect(sem!.metadata?.confidence).toBe('raw_code')
      expect(sem!.metadata?.degradationCause).toBe('syntax_error')
    })
  })

  describe('已知概念但寫法不匹配 → unsupported', () => {
    it('should set degradationCause to unsupported for known node type with no matching pattern', () => {
      setup()
      // binary_expression is a known AST node type (maps to arithmetic/compare/logic concepts)
      // but with an unknown operator it should degrade
      // Actually, binary_expression with unknown op falls back to arithmetic in hand-written lifter
      // So let's use a node type that has a concept mapping but the pattern doesn't match
      // For this test, we need an AST node type that IS in the concept mapping but fails to match
      // Let's test with a completely empty compound_statement (no children to lift)
      // Actually, let me use an approach: register a concept for a known AST type,
      // then give a node of that type that doesn't match
      registry.register({
        id: 'test_known',
        layer: 'lang-core',
        level: 0,
        propertyNames: [],
        childNames: [],
      })
      // Map an AST nodeType to this concept in the lifter's concept mapping
      lifter.setAstNodeConceptMap(new Map([['some_known_type', 'test_known']]))

      const ast = mockNode('some_known_type', 'some_unknown_code')
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      expect(sem!.metadata?.confidence).toBe('raw_code')
      expect(sem!.metadata?.degradationCause).toBe('unsupported')
    })
  })

  describe('完全未知節點類型 → nonstandard_but_valid', () => {
    it('should set degradationCause to nonstandard_but_valid for unknown node type', () => {
      setup()
      const ast = mockNode('lambda_expression', '[](){ return 1; }')
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      expect(sem!.concept).toBe('raw_code')
      expect(sem!.metadata?.confidence).toBe('raw_code')
      expect(sem!.metadata?.degradationCause).toBe('nonstandard_but_valid')
    })
  })

  describe('部分子節點可 lift → confidence: inferred', () => {
    it('should set confidence to inferred for partially liftable nodes', () => {
      setup()
      const liftableChild = mockNode('number_literal', '42')
      const unknownChild = mockNode('lambda_expression', '[](){}')
      const ast = mockNode('some_wrapper', 'wrapper(42, [](){})', [liftableChild, unknownChild])
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      expect(sem!.metadata?.confidence).toBe('inferred')
    })
  })

  describe('外層 confidence 不受內層降級影響', () => {
    it('should keep outer confidence as high even when inner child degrades', () => {
      setup()
      // If binary expression matches pattern (outer = high), but one operand degrades,
      // outer should still be high
      const left = mockNode('number_literal', '3')
      const right = mockNode('lambda_expression', '[](){}')  // degrades
      const op = unnamed('+', '+')
      const ast = mockNode('binary_expression', '3 + [](){}', [left, op, right], { left, right })
      const sem = lifter.liftWithContext(ast, new LiftContextData())
      expect(sem).not.toBeNull()
      // The outer node matched arithmetic pattern → should be high
      expect(sem!.metadata?.confidence).toBe('high')
      // The right child should be raw_code
      const rightChild = sem!.children.right?.[0]
      expect(rightChild?.concept).toBe('raw_code')
      expect(rightChild?.metadata?.confidence).toBe('raw_code')
    })
  })
})
