/**
 * TDD tests for Phase B Item 4: STATEMENT_TO_EXPRESSION → BlockSpec metadata
 *
 * After refactoring, renderExpression() should query PatternRenderer for
 * expression counterparts instead of using hardcoded STATEMENT_TO_EXPRESSION.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { PatternRenderer } from '../../../src/core/projection/pattern-renderer'
import type { BlockSpec } from '../../../src/core/types'

function makeSpec(blockType: string, conceptId: string, opts: {
  hasOutput?: boolean
  hasPreviousStatement?: boolean
  expressionCounterpart?: string
} = {}): BlockSpec {
  const blockDef: Record<string, unknown> = { type: blockType }
  if (opts.hasOutput) blockDef.output = 'Expression'
  if (opts.hasPreviousStatement !== false && !opts.hasOutput) {
    blockDef.previousStatement = null
    blockDef.nextStatement = null
  }
  return {
    id: blockType,
    language: 'cpp',
    category: 'test',
    level: 1,
    version: '1.0.0',
    concept: { conceptId, properties: [], children: {} },
    blockDef,
    codeTemplate: { pattern: '', imports: [], order: 0 },
    astPattern: { nodeType: '_none', constraints: [] },
    renderMapping: {
      fields: {},
      inputs: {},
      statementInputs: {},
      expressionCounterpart: opts.expressionCounterpart,
    },
  }
}

describe('PatternRenderer.getExpressionCounterpart', () => {
  let renderer: PatternRenderer

  beforeEach(() => {
    renderer = new PatternRenderer()
    renderer.loadBlockSpecs([
      makeSpec('c_increment', 'cpp_increment', { expressionCounterpart: 'c_increment_expr' }),
      makeSpec('c_compound_assign', 'cpp_compound_assign', { expressionCounterpart: 'c_compound_assign_expr' }),
      makeSpec('c_scanf', 'cpp_scanf', { expressionCounterpart: 'c_scanf_expr' }),
      makeSpec('u_var_declare', 'var_declare', { expressionCounterpart: 'c_var_declare_expr' }),
      makeSpec('u_input', 'input', { expressionCounterpart: 'u_input_expr' }),
      makeSpec('c_increment_expr', 'cpp_increment_expr', { hasOutput: true }),
    ])
  })

  it('returns expression counterpart for statement blocks', () => {
    expect(renderer.getExpressionCounterpart('c_increment')).toBe('c_increment_expr')
    expect(renderer.getExpressionCounterpart('c_compound_assign')).toBe('c_compound_assign_expr')
    expect(renderer.getExpressionCounterpart('c_scanf')).toBe('c_scanf_expr')
    expect(renderer.getExpressionCounterpart('u_var_declare')).toBe('c_var_declare_expr')
    expect(renderer.getExpressionCounterpart('u_input')).toBe('u_input_expr')
  })

  it('returns undefined for blocks without expression counterpart', () => {
    expect(renderer.getExpressionCounterpart('c_increment_expr')).toBeUndefined()
    expect(renderer.getExpressionCounterpart('nonexistent')).toBeUndefined()
  })
})
