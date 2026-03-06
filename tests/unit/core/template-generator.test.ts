import { describe, it, expect, beforeEach } from 'vitest'
import { TemplateGenerator } from '../../../src/core/projection/template-generator'
import { createNode } from '../../../src/core/semantic-tree'
import type { CodeTemplate, UniversalTemplate, StylePreset } from '../../../src/core/types'

const defaultStyle: StylePreset = {
  id: 'default',
  name: { en: 'Default', 'zh-TW': '預設' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

describe('TemplateGenerator', () => {
  let gen: TemplateGenerator

  beforeEach(() => {
    gen = new TemplateGenerator()
  })

  describe('property substitution', () => {
    it('should substitute ${FIELD} with properties', () => {
      gen.registerTemplate('cpp_increment', {
        pattern: '${NAME}${OP}',
        imports: [],
        order: 8,
      })

      const node = createNode('cpp_increment', { NAME: 'i', OP: '++' })
      const result = gen.generate(node, { indent: 0, style: defaultStyle })
      expect(result).toBe('i++')
    })

    it('should substitute multiple fields', () => {
      gen.registerTemplate('cpp_compound_assign', {
        pattern: '${NAME} ${OP} ${VALUE};',
        imports: [],
        order: 0,
      })

      const valueNode = createNode('number_literal', { value: '5' })
      const node = createNode('cpp_compound_assign', { NAME: 'x', OP: '+=' }, { VALUE: [valueNode] })

      // Register child generator
      gen.registerTemplate('number_literal', { pattern: '${value}', imports: [], order: 20 })

      const result = gen.generate(node, { indent: 0, style: defaultStyle })
      expect(result).toBe('x += 5;')
    })
  })

  describe('child expression substitution', () => {
    it('should substitute ${CHILD} by generating child expression', () => {
      gen.registerTemplate('return', {
        pattern: 'return ${VALUE};',
        imports: [],
        order: 0,
      })
      gen.registerTemplate('number_literal', {
        pattern: '${value}',
        imports: [],
        order: 20,
      })

      const valNode = createNode('number_literal', { value: '42' })
      const node = createNode('return', {}, { VALUE: [valNode] })

      const result = gen.generate(node, { indent: 0, style: defaultStyle })
      expect(result).toBe('return 42;')
    })
  })

  describe('body substitution', () => {
    it('should substitute ${BODY} with indented child statements', () => {
      gen.registerTemplate('while_loop', {
        pattern: 'while (${CONDITION}) {\n${BODY}\n}',
        imports: [],
        order: 0,
      })
      gen.registerTemplate('var_assign', {
        pattern: '${name} = ${VALUE};',
        imports: [],
        order: 0,
      })
      gen.registerTemplate('number_literal', {
        pattern: '${value}',
        imports: [],
        order: 20,
      })

      const assignVal = createNode('number_literal', { value: '1' })
      const assignNode = createNode('var_assign', { name: 'x' }, { VALUE: [assignVal] })
      const condNode = createNode('var_ref', { name: 'running' })
      gen.registerTemplate('var_ref', { pattern: '${name}', imports: [], order: 20 })

      const whileNode = createNode('while_loop', {}, {
        CONDITION: [condNode],
        BODY: [assignNode],
      })

      const result = gen.generate(whileNode, { indent: 0, style: defaultStyle })
      expect(result).toContain('while (running)')
      expect(result).toContain('x = 1;')
    })
  })

  describe('universal templates with styleVariants', () => {
    it('should select correct style variant', () => {
      const template: UniversalTemplate = {
        conceptId: 'print',
        styleVariants: {
          cout: { pattern: 'cout << ${EXPR}', imports: ['iostream'], order: 0 },
          printf: { pattern: 'printf("%s", ${EXPR})', imports: ['stdio.h'], order: 0 },
        },
        styleKey: 'io_style',
        order: 0,
      }
      gen.loadUniversalTemplates([template])

      const exprNode = createNode('var_ref', { name: 'x' })
      gen.registerTemplate('var_ref', { pattern: '${name}', imports: [], order: 20 })

      const printNode = createNode('print', {}, { EXPR: [exprNode] })
      const result = gen.generate(printNode, { indent: 0, style: defaultStyle }) // io_style = 'cout'
      expect(result).toContain('cout << x')
    })
  })

  describe('fallback', () => {
    it('should return null for unknown concept', () => {
      const node = createNode('unknown_concept', { x: '1' })
      const result = gen.generate(node, { indent: 0, style: defaultStyle })
      expect(result).toBeNull()
    })
  })

  describe('imports collection', () => {
    it('should collect imports from templates', () => {
      gen.registerTemplate('cpp_printf', {
        pattern: 'printf("${FORMAT}"${ARGS});',
        imports: ['stdio.h'],
        order: 0,
      })

      const node = createNode('cpp_printf', { FORMAT: '%d', ARGS: ', x' })
      gen.generate(node, { indent: 0, style: defaultStyle })
      expect(gen.getCollectedImports()).toContain('stdio.h')
    })
  })
})
