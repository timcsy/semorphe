import { describe, it, expect } from 'vitest'
import { runDiagnostics } from '../../../src/core/diagnostics'
import type { DiagnosticBlock } from '../../../src/core/diagnostics'
import { cppDiagnosticRules } from '../../../src/languages/cpp/diagnostics'

function makeBlock(overrides: Partial<DiagnosticBlock> & { id: string; type: string }): DiagnosticBlock {
  return {
    getFieldValue: () => null,
    getInputTargetBlock: () => null,
    getInput: () => null,
    ...overrides,
  }
}

describe('runDiagnostics', () => {
  it('should return empty array for no blocks', () => {
    expect(runDiagnostics([], cppDiagnosticRules)).toEqual([])
  })

  it('should warn when cpp_if is missing condition', () => {
    const block = makeBlock({ id: 'b1', type: 'cpp_if' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ blockId: 'b1', severity: 'warning', message: 'DIAG_MISSING_CONDITION' })
  })

  it('should not warn when cpp_if has condition', () => {
    const block = makeBlock({
      id: 'b1',
      type: 'cpp_if',
      getInputTargetBlock: (name: string) => name === 'CONDITION' ? makeBlock({ id: 'c1', type: 'cpp_compare' }) : null,
    })
    expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
  })

  it('should warn when cpp_if_else is missing condition', () => {
    const block = makeBlock({ id: 'b2', type: 'cpp_if_else' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('DIAG_MISSING_CONDITION')
  })

  it('should warn when cpp_loop_while is missing condition', () => {
    const block = makeBlock({ id: 'b3', type: 'cpp_loop_while' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('DIAG_MISSING_CONDITION')
  })

  it('should warn when cpp_print is missing expression', () => {
    const block = makeBlock({ id: 'b4', type: 'cpp_print' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('DIAG_MISSING_VALUE')
  })

  it('should not warn when cpp_print has expression', () => {
    const block = makeBlock({
      id: 'b4',
      type: 'cpp_print',
      getInputTargetBlock: (name: string) => name === 'EXPR0' ? makeBlock({ id: 'e1', type: 'cpp_literal_string' }) : null,
    })
    expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
  })

  it('should warn when cpp_var_declare has empty name', () => {
    const block = makeBlock({
      id: 'b5',
      type: 'cpp_var_declare',
      getFieldValue: (name: string) => name === 'NAME' ? '' : null,
    })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('DIAG_MISSING_VALUE')
  })

  it('should warn for indexed var_declare with empty name', () => {
    const block = makeBlock({
      id: 'b6',
      type: 'cpp_var_declare',
      getFieldValue: (name: string) => {
        if (name === 'NAME_0') return ''
        if (name === 'NAME_1') return 'y'
        return null
      },
    })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('DIAG_MISSING_VALUE')
  })

  it('should handle multiple blocks with mixed diagnostics', () => {
    const blocks = [
      makeBlock({ id: 'b1', type: 'cpp_if' }),
      makeBlock({
        id: 'b2',
        type: 'cpp_if',
        getInputTargetBlock: (name: string) => name === 'CONDITION' ? makeBlock({ id: 'c1', type: 'cpp_compare' }) : null,
      }),
      makeBlock({ id: 'b3', type: 'cpp_print' }),
    ]
    const result = runDiagnostics(blocks, cppDiagnosticRules)
    expect(result).toHaveLength(2)
    expect(result.map(d => d.blockId)).toEqual(['b1', 'b3'])
  })
})
