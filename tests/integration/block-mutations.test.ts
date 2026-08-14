import { describe, it, expect } from 'vitest'
import { runDiagnostics } from '../../src/core/diagnostics'
import type { DiagnosticBlock } from '../../src/core/diagnostics'
import { cppDiagnosticRules } from '../../src/languages/cpp/diagnostics'

function makeBlock(overrides: Partial<DiagnosticBlock> & { id: string; type: string }): DiagnosticBlock {
  return {
    // ⚠️ `nodeId` 故意與 `id` 不同——見 `tests/unit/core/diagnostics.test.ts` 的說明
    nodeId: `n_${overrides.id}`,
    getFieldValue: () => null,
    getInputTargetBlock: () => null,
    getInput: () => null,
    ...overrides,
  }
}

describe('Block mutations integration', () => {
  describe('if-else with else-if chains', () => {
    it('should diagnose missing condition in cpp_if_else', () => {
      const block = makeBlock({ id: 'if1', type: 'cpp_if_else' })
      const result = runDiagnostics([block], cppDiagnosticRules)
      expect(result).toHaveLength(1)
      expect(result[0].message).toBe('DIAG_MISSING_CONDITION')
    })

    it('should pass when condition is present', () => {
      const block = makeBlock({
        id: 'if1',
        type: 'cpp_if_else',
        getInputTargetBlock: (name: string) =>
          name === 'CONDITION' ? makeBlock({ id: 'c', type: 'cpp_compare' }) : null,
      })
      expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
    })
  })

  describe('multi-variable var_declare', () => {
    it('should diagnose empty first variable name', () => {
      const block = makeBlock({
        id: 'v1',
        type: 'cpp_var_declare',
        getFieldValue: (name: string) => {
          if (name === 'NAME_0') return ''
          return null
        },
      })
      const result = runDiagnostics([block], cppDiagnosticRules)
      expect(result).toHaveLength(1)
      expect(result[0].message).toBe('DIAG_MISSING_VALUE')
    })

    it('should pass when all variables have names', () => {
      const block = makeBlock({
        id: 'v1',
        type: 'cpp_var_declare',
        getFieldValue: (name: string) => {
          if (name === 'NAME_0') return 'x'
          if (name === 'NAME_1') return 'y'
          return null
        },
      })
      expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
    })

    it('should detect empty name among multiple vars', () => {
      const block = makeBlock({
        id: 'v2',
        type: 'cpp_var_declare',
        getFieldValue: (name: string) => {
          if (name === 'NAME_0') return 'x'
          if (name === 'NAME_1') return '  '
          if (name === 'NAME_2') return 'z'
          return null
        },
      })
      const result = runDiagnostics([block], cppDiagnosticRules)
      expect(result).toHaveLength(1)
    })
  })

  describe('input block multi-variable', () => {
    it('should not diagnose cpp_input (no current rule)', () => {
      const block = makeBlock({ id: 'i1', type: 'cpp_input' })
      expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
    })
  })

  describe('mixed workspace diagnostics', () => {
    it('should detect multiple issues across blocks', () => {
      const blocks = [
        makeBlock({ id: 'b1', type: 'cpp_if' }), // missing condition
        makeBlock({ id: 'b2', type: 'cpp_loop_while' }), // missing condition
        makeBlock({
          id: 'b3',
          type: 'cpp_print',
          getInputTargetBlock: (name: string) =>
            name === 'EXPR0' ? makeBlock({ id: 'e', type: 'cpp_literal_string' }) : null,
        }), // OK
        makeBlock({
          id: 'b4',
          type: 'cpp_var_declare',
          getFieldValue: (name: string) => name === 'NAME' ? '' : null,
        }), // empty name
      ]
      const result = runDiagnostics(blocks, cppDiagnosticRules)
      expect(result).toHaveLength(3)
      expect(result.map(d => d.nodeId).sort()).toEqual(['n_b1', 'n_b2', 'n_b4'])
    })
  })
})
