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
        id: 'c_increment',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_increment',
          abstractConcept: 'increment',
          properties: ['name', 'operator'],
          role: 'both',
        },
        blockDef: {
          type: 'c_increment',
          args0: [
            { type: 'field_input', name: 'NAME', text: 'i' },
            { type: 'field_dropdown', name: 'OP', options: [['++', '++'], ['--', '--']] },
          ],
        },
        codeTemplate: { pattern: '${NAME}${OP}', imports: [], order: 8 },
        astPattern: { nodeType: 'update_expression', constraints: [] },
      }
      renderer.loadBlockSpecs([spec])

      const node = createNode('cpp_increment', { name: 'i', operator: '++' })
      const result = renderer.render(node)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('c_increment')
      expect(result!.fields.NAME).toBe('i')
      expect(result!.fields.OP).toBe('++')
    })
  })

  describe('explicit renderMapping', () => {
    it('should use explicit renderMapping when provided', () => {
      const spec: BlockSpec = {
        id: 'c_increment',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_increment',
          properties: ['name', 'operator'],
          role: 'both',
        },
        blockDef: { type: 'c_increment' },
        codeTemplate: { pattern: '${NAME}${OP}', imports: [], order: 8 },
        astPattern: { nodeType: 'update_expression', constraints: [] },
        renderMapping: {
          fields: { NAME: 'name', OP: 'operator' },
          inputs: {},
          statementInputs: {},
        },
      }
      renderer.loadBlockSpecs([spec])

      const node = createNode('cpp_increment', { name: 'j', operator: '--' })
      const result = renderer.render(node)

      expect(result).not.toBeNull()
      expect(result!.fields.NAME).toBe('j')
      expect(result!.fields.OP).toBe('--')
    })
  })

  describe('inputs mapping (expression children)', () => {
    it('should render expression child as input', () => {
      const spec: BlockSpec = {
        id: 'u_return',
        language: 'universal',
        category: 'functions',
        level: 0,
        version: '1.0.0',
        concept: {
          conceptId: 'return',
          children: { value: 'expression' },
          role: 'statement',
        },
        blockDef: {
          type: 'u_return',
          args0: [
            { type: 'input_value', name: 'VALUE', check: 'Expression' },
          ],
        },
        codeTemplate: { pattern: 'return ${VALUE};', imports: [], order: 0 },
        astPattern: { nodeType: 'return_statement', constraints: [] },
      }

      const numSpec: BlockSpec = {
        id: 'u_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: {
          conceptId: 'number_literal',
          properties: ['value'],
          role: 'expression',
        },
        blockDef: {
          type: 'u_number',
          args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
        },
        codeTemplate: { pattern: '${NUM}', imports: [], order: 20 },
        astPattern: { nodeType: 'number_literal', constraints: [] },
      }

      renderer.loadBlockSpecs([spec, numSpec])

      const valNode = createNode('number_literal', { value: '42' })
      const retNode = createNode('return', {}, { value: [valNode] })
      const result = renderer.render(retNode)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('u_return')
      expect(result!.inputs.VALUE).toBeDefined()
      expect(result!.inputs.VALUE.block.type).toBe('u_number')
      expect(result!.inputs.VALUE.block.fields.NUM).toBe('42')
    })
  })

  describe('statementInputs mapping', () => {
    it('should render statement children as chained blocks', () => {
      const spec: BlockSpec = {
        id: 'u_while_loop',
        language: 'universal',
        category: 'control',
        level: 0,
        version: '1.0.0',
        concept: {
          conceptId: 'while_loop',
          children: { condition: 'expression', body: 'statements' },
          role: 'statement',
        },
        blockDef: {
          type: 'u_while_loop',
          args0: [{ type: 'input_value', name: 'COND', check: 'Expression' }],
          args1: [{ type: 'input_statement', name: 'BODY', check: 'Statement' }],
        },
        codeTemplate: { pattern: 'while (${COND}) {\n${BODY}\n}', imports: [], order: 0 },
        astPattern: { nodeType: 'while_statement', constraints: [] },
      }

      const breakSpec: BlockSpec = {
        id: 'u_break',
        language: 'universal',
        category: 'control',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'break', role: 'statement' },
        blockDef: { type: 'u_break' },
        codeTemplate: { pattern: 'break;', imports: [], order: 0 },
        astPattern: { nodeType: 'break_statement', constraints: [] },
      }

      renderer.loadBlockSpecs([spec, breakSpec])

      const condNode = createNode('var_ref', { name: 'x' })
      const bodyNode = createNode('break', {})
      const whileNode = createNode('while_loop', {}, {
        condition: [condNode],
        body: [bodyNode],
      })
      const result = renderer.render(whileNode)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('u_while_loop')
      expect(result!.inputs.BODY).toBeDefined()
      expect(result!.inputs.BODY.block.type).toBe('u_break')
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
