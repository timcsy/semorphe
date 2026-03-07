/**
 * 註解 Roundtrip 測試
 *
 * 驗證行尾註解、獨立註解、表達式內部註解在 lift → generate roundtrip 後保留
 */
import { describe, it, expect } from 'vitest'
import { Lifter } from '../../../src/core/lift/lifter'
import { PatternLifter } from '../../../src/core/lift/pattern-lifter'
import { LiftContextData } from '../../../src/core/lift/lift-context'
import { registerExpressionLifters } from '../../../src/languages/cpp/lifters/expressions'
import { createNode } from '../../../src/core/semantic-tree'
import type { AstNode, LiftContext } from '../../../src/core/lift/types'
import type { BlockSpec, LiftPattern, SemanticNode } from '../../../src/core/types'

import universalBlocks from '../../../src/blocks/universal.json'
import basicBlocks from '../../../src/languages/cpp/blocks/basic.json'
import specialBlocks from '../../../src/languages/cpp/blocks/special.json'
import liftPatternsJson from '../../../src/languages/cpp/lift-patterns.json'

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

function mockNodeAt(
  type: string,
  text: string,
  row: number,
  col: number,
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
    startPosition: { row, column: col },
    endPosition: { row, column: col + text.length },
  }
}

function unnamed(type: string, text: string): AstNode {
  return { ...mockNode(type, text), isNamed: false }
}

describe('Annotation Roundtrip', () => {
  let lifter: Lifter

  function setup() {
    lifter = new Lifter()
    const patternLifter = new PatternLifter()

    const allSpecs = [
      ...universalBlocks as unknown as BlockSpec[],
      ...basicBlocks as unknown as BlockSpec[],
      ...specialBlocks as unknown as BlockSpec[],
    ]

    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
    patternLifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    patternLifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(patternLifter)
    registerExpressionLifters(lifter)
  }

  describe('獨立註解', () => {
    it('should lift standalone comment as comment semantic node', () => {
      setup()
      // Simulate: // section header\nint x = 1;
      const commentNode = mockNodeAt('comment', '// section header', 0, 0)
      const stmtNode = mockNodeAt('number_literal', '42', 1, 0)

      const data = new LiftContextData()
      const results = lifter.liftStatements([commentNode, stmtNode])
      expect(results.length).toBe(2)
      expect(results[0].concept).toBe('comment')
      expect(results[0].properties.text).toBe('// section header')
    })

    it('should keep two consecutive comments as separate nodes', () => {
      setup()
      const c1 = mockNodeAt('comment', '// first', 0, 0)
      const c2 = mockNodeAt('comment', '// second', 1, 0)

      const results = lifter.liftStatements([c1, c2])
      expect(results.length).toBe(2)
      expect(results[0].concept).toBe('comment')
      expect(results[1].concept).toBe('comment')
    })
  })

  describe('行尾註解', () => {
    it('should attach inline comment as annotation on previous sibling', () => {
      setup()
      // Simulate: x = 1; // set x  (same row)
      const stmtNode = mockNodeAt('number_literal', '42', 0, 0)
      const commentNode = mockNodeAt('comment', '// set x', 0, 10)

      const data = new LiftContextData()
      const results = lifter.liftStatements([stmtNode, commentNode])
      // Should be 1 node with an annotation (comment absorbed)
      expect(results.length).toBe(1)
      expect(results[0].annotations).toBeDefined()
      expect(results[0].annotations!.length).toBe(1)
      expect(results[0].annotations![0].position).toBe('inline')
      expect(results[0].annotations![0].text).toBe('// set x')
    })
  })

  describe('raw_code 節點上的行尾註解', () => {
    it('should attach inline comment as annotation even on raw_code nodes', () => {
      setup()
      // Unknown node + inline comment on same row
      const unknownNode = mockNodeAt('lambda_expression', '[](){}', 0, 0)
      const commentNode = mockNodeAt('comment', '// lambda', 0, 10)

      const results = lifter.liftStatements([unknownNode, commentNode])
      expect(results.length).toBe(1)
      expect(results[0].concept).toBe('raw_code')
      expect(results[0].annotations).toBeDefined()
      expect(results[0].annotations![0].position).toBe('inline')
      expect(results[0].annotations![0].text).toBe('// lambda')
    })
  })
})
