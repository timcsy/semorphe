import { describe, it, expect, beforeEach } from 'vitest'
import { PatternExtractor } from '../../../src/core/projection/pattern-extractor'
import type { BlockSpec } from '../../../src/core/types'

// Minimal block state interface for testing
interface TestBlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: TestBlockState }>
  next?: { block: TestBlockState }
  extraState?: Record<string, unknown>
}

describe('PatternExtractor', () => {
  let extractor: PatternExtractor

  beforeEach(() => {
    extractor = new PatternExtractor()
  })

  describe('field extraction', () => {
    it('should extract fields to semantic properties', () => {
      const spec: BlockSpec = {
        id: 'cpp_increment',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        conceptMapping: {
          conceptId: 'cpp:increment',
          properties: ['name', 'operator'],
          role: 'both',
        },
        blockDef: {
          type: 'cpp_increment',
          args0: [
            { type: 'field_input', name: 'NAME', text: 'i' },
            { type: 'field_dropdown', name: 'OP', options: [['++', '++'], ['--', '--']] },
          ],
        },
        renderMapping: { fields: { NAME: 'name', OP: 'operator' }, inputs: {}, statementInputs: {} },
        codeTemplate: { pattern: '${NAME}${OP}', imports: [], order: 8 },
        astPattern: { nodeType: 'update_expression', constraints: [] },
      }
      extractor.loadBlockSpecs([spec])

      const block: TestBlockState = {
        type: 'cpp_increment',
        id: 'block_1',
        fields: { NAME: 'i', OP: '++' },
        inputs: {},
      }
      const result = extractor.extract(block as any)

      expect(result).not.toBeNull()
      expect(result!.conceptId).toBe('cpp:increment')
      expect(result!.properties.name).toBe('i')
      expect(result!.properties.operator).toBe('++')
    })
  })

  describe('input extraction (expression children)', () => {
    it('should extract value inputs as expression children', () => {
      const retSpec: BlockSpec = {
        id: 'cpp_return',
        language: 'universal',
        category: 'functions',
        level: 0,
        version: '1.0.0',
        conceptMapping: {
          conceptId: 'cpp:return',
          children: { value: 'expression' },
          role: 'statement',
        },
        blockDef: {
          type: 'cpp_return',
          args0: [{ type: 'input_value', name: 'VALUE', check: 'Expression' }],
        },
        renderMapping: { fields: {}, inputs: { VALUE: 'value' }, statementInputs: {} },
        codeTemplate: { pattern: 'return ${VALUE};', imports: [], order: 0 },
        astPattern: { nodeType: 'return_statement', constraints: [] },
      }

      const numSpec: BlockSpec = {
        id: 'cpp_literal_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        conceptMapping: {
          conceptId: 'cpp:literal_number',
          properties: ['value'],
          role: 'expression',
        },
        blockDef: {
          type: 'cpp_literal_number',
          args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
        },
        renderMapping: { fields: { NUM: 'value' }, inputs: {}, statementInputs: {} },
        codeTemplate: { pattern: '${NUM}', imports: [], order: 20 },
        astPattern: { nodeType: 'number_literal', constraints: [] },
      }

      extractor.loadBlockSpecs([retSpec, numSpec])

      const block: TestBlockState = {
        type: 'cpp_return',
        id: 'block_1',
        fields: {},
        inputs: {
          VALUE: {
            block: {
              type: 'cpp_literal_number',
              id: 'block_2',
              fields: { NUM: 42 },
              inputs: {},
            },
          },
        },
      }
      const result = extractor.extract(block as any)

      expect(result).not.toBeNull()
      expect(result!.conceptId).toBe('cpp:return')
      expect(result!.children.value).toHaveLength(1)
      expect(result!.children.value[0].conceptId).toBe('cpp:literal_number')
      expect(result!.children.value[0].properties.value).toBe('42')
    })
  })

  describe('statement input extraction', () => {
    it('should extract statement chain as children array', () => {
      const whileSpec: BlockSpec = {
        id: 'cpp_loop_while',
        language: 'universal',
        category: 'control',
        level: 0,
        version: '1.0.0',
        conceptMapping: {
          conceptId: 'cpp:loop_while',
          children: { condition: 'expression', body: 'statements' },
          role: 'statement',
        },
        blockDef: {
          type: 'cpp_loop_while',
          args0: [{ type: 'input_value', name: 'COND', check: 'Expression' }],
          args1: [{ type: 'input_statement', name: 'BODY', check: 'Statement' }],
        },
        renderMapping: { fields: {}, inputs: { COND: 'condition' }, statementInputs: { BODY: 'body' } },
        codeTemplate: { pattern: 'while (${COND}) {\n${BODY}\n}', imports: [], order: 0 },
        astPattern: { nodeType: 'while_statement', constraints: [] },
      }

      const breakSpec: BlockSpec = {
        id: 'cpp_break',
        language: 'universal',
        category: 'control',
        level: 0,
        version: '1.0.0',
        conceptMapping: { conceptId: 'cpp:break', role: 'statement' },
        blockDef: { type: 'cpp_break' },
        codeTemplate: { pattern: 'break;', imports: [], order: 0 },
        astPattern: { nodeType: 'break_statement', constraints: [] },
      }

      const contSpec: BlockSpec = {
        id: 'cpp_continue',
        language: 'universal',
        category: 'control',
        level: 0,
        version: '1.0.0',
        conceptMapping: { conceptId: 'cpp:continue', role: 'statement' },
        blockDef: { type: 'cpp_continue' },
        codeTemplate: { pattern: 'continue;', imports: [], order: 0 },
        astPattern: { nodeType: 'continue_statement', constraints: [] },
      }

      extractor.loadBlockSpecs([whileSpec, breakSpec, contSpec])

      const block: TestBlockState = {
        type: 'cpp_loop_while',
        id: 'block_1',
        fields: {},
        inputs: {
          BODY: {
            block: {
              type: 'cpp_break',
              id: 'block_2',
              fields: {},
              inputs: {},
              next: {
                block: {
                  type: 'cpp_continue',
                  id: 'block_3',
                  fields: {},
                  inputs: {},
                },
              },
            },
          },
        },
      }
      const result = extractor.extract(block as any)

      expect(result).not.toBeNull()
      expect(result!.conceptId).toBe('cpp:loop_while')
      expect(result!.children.body).toHaveLength(2)
      expect(result!.children.body[0].conceptId).toBe('cpp:break')
      expect(result!.children.body[1].conceptId).toBe('cpp:continue')
    })
  })

  describe('unknown block type', () => {
    it('should return null for unknown block type', () => {
      const block: TestBlockState = {
        type: 'unknown_block',
        id: 'block_1',
        fields: {},
        inputs: {},
      }
      const result = extractor.extract(block as any)
      expect(result).toBeNull()
    })
  })
})
