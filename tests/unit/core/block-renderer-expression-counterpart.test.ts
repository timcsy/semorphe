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
    conceptMapping: { conceptId, properties: [], children: {} },
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
      makeSpec('cpp_increment', 'cpp_increment', { expressionCounterpart: 'cpp_increment_expression' }),
      makeSpec('cpp_var_assign_compound', 'cpp_compound_assign', { expressionCounterpart: 'cpp_var_assign_compound_expression' }),
      makeSpec('cpp_input_formatted', 'cpp_scanf', { expressionCounterpart: 'cpp_input_formatted_expression' }),
      makeSpec('cpp_var_declare', 'cpp:var_declare', { expressionCounterpart: 'cpp_var_declare_expression' }),
      makeSpec('cpp_input', 'cpp:input', { expressionCounterpart: 'cpp_input_expression' }),
      makeSpec('cpp_increment_expression', 'cpp_increment_expr', { hasOutput: true }),
    ])
  })

  it('returns expression counterpart for statement blocks', () => {
    expect(renderer.getExpressionCounterpart('cpp_increment')).toBe('cpp_increment_expression')
    expect(renderer.getExpressionCounterpart('cpp_var_assign_compound')).toBe('cpp_var_assign_compound_expression')
    expect(renderer.getExpressionCounterpart('cpp_input_formatted')).toBe('cpp_input_formatted_expression')
    expect(renderer.getExpressionCounterpart('cpp_var_declare')).toBe('cpp_var_declare_expression')
    expect(renderer.getExpressionCounterpart('cpp_input')).toBe('cpp_input_expression')
  })

  it('returns undefined for blocks without expression counterpart', () => {
    expect(renderer.getExpressionCounterpart('cpp_increment_expression')).toBeUndefined()
    expect(renderer.getExpressionCounterpart('nonexistent')).toBeUndefined()
  })
})
