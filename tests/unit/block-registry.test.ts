import { describe, it, expect, beforeEach } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import type { BlockSpec, ValidationError } from '../../src/core/types'

function createValidSpec(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    id: 'c_for_loop',
    category: 'loops',
    version: '1.0.0',
    blockDef: {
      type: 'c_for_loop',
      message0: 'for %1 ; %2 ; %3',
      args0: [
        { type: 'input_value', name: 'INIT', check: 'Expression' },
        { type: 'input_value', name: 'COND', check: 'Boolean' },
        { type: 'input_value', name: 'UPDATE', check: 'Expression' },
      ],
      message1: 'do %1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'C for loop',
    },
    codeTemplate: {
      pattern: 'for (${INIT}; ${COND}; ${UPDATE}) {\n${BODY}\n}',
      imports: [],
      order: 0,
    },
    astPattern: {
      nodeType: 'for_statement',
      constraints: [],
    },
    ...overrides,
  }
}

describe('BlockRegistry', () => {
  let registry: BlockRegistry

  beforeEach(() => {
    registry = new BlockRegistry()
  })

  describe('register', () => {
    it('should register a valid block spec', () => {
      const spec = createValidSpec()
      registry.register(spec)
      expect(registry.get('c_for_loop')).toEqual(spec)
    })

    it('should throw on invalid spec', () => {
      const invalid = { id: '', category: '', version: '', blockDef: {}, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: '', constraints: [] } } as BlockSpec
      expect(() => registry.register(invalid)).toThrow()
    })

    it('should throw on duplicate id', () => {
      const spec = createValidSpec()
      registry.register(spec)
      expect(() => registry.register(spec)).toThrow()
    })
  })

  describe('unregister', () => {
    it('should remove a registered block', () => {
      const spec = createValidSpec()
      registry.register(spec)
      registry.unregister('c_for_loop')
      expect(registry.get('c_for_loop')).toBeUndefined()
    })

    it('should not throw for non-existent id', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent id', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('should return the registered spec', () => {
      const spec = createValidSpec()
      registry.register(spec)
      expect(registry.get('c_for_loop')).toEqual(spec)
    })
  })

  describe('getByNodeType', () => {
    it('should return empty array for unknown node type', () => {
      expect(registry.getByNodeType('unknown')).toEqual([])
    })

    it('should return specs matching node type', () => {
      const spec = createValidSpec()
      registry.register(spec)
      const results = registry.getByNodeType('for_statement')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('c_for_loop')
    })

    it('should return multiple specs for same node type', () => {
      const spec1 = createValidSpec({ id: 'c_for_loop', blockDef: { type: 'c_for_loop' } })
      const spec2 = createValidSpec({
        id: 'c_for_range',
        blockDef: { type: 'c_for_range' },
        astPattern: { nodeType: 'for_statement', constraints: [{ field: 'type', text: 'range' }] },
      })
      registry.register(spec1)
      registry.register(spec2)
      expect(registry.getByNodeType('for_statement')).toHaveLength(2)
    })
  })

  describe('getByCategory', () => {
    it('should return empty array for unknown category', () => {
      expect(registry.getByCategory('unknown')).toEqual([])
    })

    it('should return block ids in category', () => {
      registry.register(createValidSpec({ id: 'c_for_loop', blockDef: { type: 'c_for_loop' }, category: 'loops' }))
      registry.register(createValidSpec({ id: 'c_while_loop', blockDef: { type: 'c_while_loop' }, category: 'loops', astPattern: { nodeType: 'while_statement', constraints: [] } }))
      const ids = registry.getByCategory('loops')
      expect(ids).toHaveLength(2)
      expect(ids).toContain('c_for_loop')
      expect(ids).toContain('c_while_loop')
    })
  })

  describe('validate', () => {
    it('should return empty array for valid spec', () => {
      const spec = createValidSpec()
      const errors = registry.validate(spec)
      expect(errors).toEqual([])
    })

    it('should return error for missing id', () => {
      const spec = createValidSpec({ id: '' })
      const errors = registry.validate(spec)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e: ValidationError) => e.field === 'id')).toBe(true)
    })

    it('should return error for missing category', () => {
      const spec = createValidSpec({ category: '' })
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'category')).toBe(true)
    })

    it('should return error for missing version', () => {
      const spec = createValidSpec({ version: '' })
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'version')).toBe(true)
    })

    it('should return error when blockDef.type mismatches id', () => {
      const spec = createValidSpec({ id: 'c_for_loop', blockDef: { type: 'wrong_type' } })
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'blockDef.type')).toBe(true)
    })

    it('should return error for empty astPattern.nodeType', () => {
      const spec = createValidSpec({ astPattern: { nodeType: '', constraints: [] } })
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'astPattern.nodeType')).toBe(true)
    })

    it('should return error for empty codeTemplate.pattern', () => {
      const spec = createValidSpec({ codeTemplate: { pattern: '', imports: [], order: 0 } })
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'codeTemplate.pattern')).toBe(true)
    })

    it('should validate arbitrary object and return errors', () => {
      const errors = registry.validate({} as unknown)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('toToolboxDef', () => {
    it('should return empty toolbox when no blocks registered', () => {
      const toolbox = registry.toToolboxDef()
      expect(toolbox).toEqual({ kind: 'categoryToolbox', contents: [] })
    })

    it('should group blocks by category', () => {
      registry.register(createValidSpec({ id: 'c_for_loop', blockDef: { type: 'c_for_loop' }, category: 'loops' }))
      registry.register(createValidSpec({
        id: 'c_printf',
        blockDef: { type: 'c_printf' },
        category: 'io',
        codeTemplate: { pattern: 'printf(${FORMAT})', imports: ['stdio.h'], order: 0 },
        astPattern: { nodeType: 'call_expression', constraints: [] },
      }))

      const toolbox = registry.toToolboxDef()
      expect(toolbox.kind).toBe('categoryToolbox')
      expect(toolbox.contents).toHaveLength(2)

      const loopsCategory = toolbox.contents.find((c: { name?: string }) => c.name === 'loops')
      expect(loopsCategory).toBeDefined()
      expect(loopsCategory!.contents).toHaveLength(1)

      const ioCategory = toolbox.contents.find((c: { name?: string }) => c.name === 'io')
      expect(ioCategory).toBeDefined()
      expect(ioCategory!.contents).toHaveLength(1)
    })

    it('should include block type in toolbox entries', () => {
      registry.register(createValidSpec({ id: 'c_for_loop', blockDef: { type: 'c_for_loop' }, category: 'loops' }))
      const toolbox = registry.toToolboxDef()
      const category = toolbox.contents[0]
      expect(category.contents[0]).toEqual({ kind: 'block', type: 'c_for_loop' })
    })
  })
})
