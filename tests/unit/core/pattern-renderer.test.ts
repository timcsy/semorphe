import { describe, it, expect, beforeEach } from 'vitest'
import { PatternRenderer } from '../../../src/core/projection/pattern-renderer'
import { createNode } from '../../../src/core/semantic-tree'
import type { BlockSpec } from '../../../src/core/types'

describe('PatternRenderer', () => {
  let renderer: PatternRenderer

  beforeEach(() => {
    renderer = new PatternRenderer()
  })

  describe('auto-derive renderMapping from blockDef', () => {
    it('should derive fields mapping for field_input', () => {
      const spec: BlockSpec = {
        id: 'cpp_increment',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        componentMapping: {
          componentId: 'cpp:increment',
          abstractConcept: 'increment',
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
      renderer.loadBlockSpecs([spec])

      const node = createNode('cpp:increment', { name: 'i', operator: '++' })
      const result = renderer.render(node)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('cpp_increment')
      expect(result!.fields.NAME).toBe('i')
      expect(result!.fields.OP).toBe('++')
    })
  })

  describe('explicit renderMapping', () => {
    it('should use explicit renderMapping when provided', () => {
      const spec: BlockSpec = {
        id: 'cpp_increment',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        componentMapping: {
          componentId: 'cpp:increment',
          properties: ['name', 'operator'],
          role: 'both',
        },
        blockDef: { type: 'cpp_increment' },
        codeTemplate: { pattern: '${NAME}${OP}', imports: [], order: 8 },
        astPattern: { nodeType: 'update_expression', constraints: [] },
        renderMapping: {
          fields: { NAME: 'name', OP: 'operator' },
          inputs: {},
          statementInputs: {},
        },
      }
      renderer.loadBlockSpecs([spec])

      const node = createNode('cpp:increment', { name: 'j', operator: '--' })
      const result = renderer.render(node)

      expect(result).not.toBeNull()
      expect(result!.fields.NAME).toBe('j')
      expect(result!.fields.OP).toBe('--')
    })
  })

  describe('inputs mapping (expression children)', () => {
    it('should render expression child as input', () => {
      const spec: BlockSpec = {
        id: 'cpp_return',
        language: 'universal',
        category: 'functions',
        level: 0,
        version: '1.0.0',
        componentMapping: {
          componentId: 'cpp:return',
          children: { value: 'expression' },
          role: 'statement',
        },
        blockDef: {
          type: 'cpp_return',
          args0: [
            { type: 'input_value', name: 'VALUE', check: 'Expression' },
          ],
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
        componentMapping: {
          componentId: 'cpp:literal_number',
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

      renderer.loadBlockSpecs([spec, numSpec])

      const valNode = createNode('cpp:literal_number', { value: '42' })
      const retNode = createNode('cpp:return', {}, { value: [valNode] })
      const result = renderer.render(retNode)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('cpp_return')
      expect(result!.inputs.VALUE).toBeDefined()
      expect(result!.inputs.VALUE.block.type).toBe('cpp_literal_number')
      expect(result!.inputs.VALUE.block.fields.NUM).toBe('42')
    })
  })

  describe('statementInputs mapping', () => {
    it('should render statement children as chained blocks', () => {
      const spec: BlockSpec = {
        id: 'cpp_loop_while',
        language: 'universal',
        category: 'control',
        level: 0,
        version: '1.0.0',
        componentMapping: {
          componentId: 'cpp:loop_while',
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
        componentMapping: { componentId: 'cpp:break', role: 'statement' },
        blockDef: { type: 'cpp_break' },
        codeTemplate: { pattern: 'break;', imports: [], order: 0 },
        astPattern: { nodeType: 'break_statement', constraints: [] },
      }

      renderer.loadBlockSpecs([spec, breakSpec])

      const condNode = createNode('cpp:var_ref', { name: 'x' })
      const bodyNode = createNode('cpp:break', {})
      const whileNode = createNode('cpp:loop_while', {}, {
        condition: [condNode],
        body: [bodyNode],
      })
      const result = renderer.render(whileNode)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('cpp_loop_while')
      expect(result!.inputs.BODY).toBeDefined()
      expect(result!.inputs.BODY.block.type).toBe('cpp_break')
    })
  })

  describe('unknown concept fallback', () => {
    it('should return null for unknown concept', () => {
      const node = createNode('unknown_concept', {})
      const result = renderer.render(node)
      expect(result).toBeNull()
    })
  })
})
