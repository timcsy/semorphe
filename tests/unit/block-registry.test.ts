import { describe, it, expect, beforeEach } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import { BEGINNER_BLOCKS } from '../../src/core/types'
import type { BlockSpec, ValidationError } from '../../src/core/types'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

function createValidSpec(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    id: 'c_for_loop',
    language: 'cpp',
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

  describe('getByLanguage', () => {
    it('should return only universal blocks when no language-specific blocks exist', () => {
      const universalSpec = createValidSpec({
        id: 'u_var_declare',
        language: 'universal',
        blockDef: { type: 'u_var_declare' },
        codeTemplate: undefined,
        astPattern: undefined,
      })
      registry.register(universalSpec)

      const results = registry.getByLanguage('cpp')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('u_var_declare')
    })

    it('should return universal + matching language blocks', () => {
      const universalSpec = createValidSpec({
        id: 'u_var_declare',
        language: 'universal',
        blockDef: { type: 'u_var_declare' },
        codeTemplate: undefined,
        astPattern: undefined,
      })
      const cppSpec = createValidSpec({
        id: 'c_for_loop',
        language: 'cpp',
        blockDef: { type: 'c_for_loop' },
      })
      registry.register(universalSpec)
      registry.register(cppSpec)

      const results = registry.getByLanguage('cpp')
      expect(results).toHaveLength(2)
      const ids = results.map(s => s.id)
      expect(ids).toContain('u_var_declare')
      expect(ids).toContain('c_for_loop')
    })

    it('should not return blocks from other languages', () => {
      const cppSpec = createValidSpec({
        id: 'c_for_loop',
        language: 'cpp',
        blockDef: { type: 'c_for_loop' },
      })
      registry.register(cppSpec)

      const results = registry.getByLanguage('python')
      expect(results).toHaveLength(0)
    })

    it('should return universal blocks for unknown language', () => {
      const universalSpec = createValidSpec({
        id: 'u_if',
        language: 'universal',
        blockDef: { type: 'u_if' },
        codeTemplate: undefined,
        astPattern: undefined,
      })
      registry.register(universalSpec)

      const results = registry.getByLanguage('unknown_lang')
      expect(results).toHaveLength(1)
      expect(results[0].language).toBe('universal')
    })
  })

  describe('getAll', () => {
    it('should return all registered blocks', () => {
      registry.register(createValidSpec({ id: 'c_for_loop', blockDef: { type: 'c_for_loop' } }))
      registry.register(createValidSpec({
        id: 'u_if',
        language: 'universal',
        blockDef: { type: 'u_if' },
        codeTemplate: undefined,
        astPattern: undefined,
      }))

      const all = registry.getAll()
      expect(all).toHaveLength(2)
    })

    it('should return empty array when no blocks registered', () => {
      expect(registry.getAll()).toHaveLength(0)
    })
  })

  describe('validate language field', () => {
    it('should return error for missing language', () => {
      const spec = { id: 'test', category: 'test', version: '1.0.0', blockDef: { type: 'test' } } as unknown
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'language')).toBe(true)
    })

    it('should not require codeTemplate/astPattern for universal blocks', () => {
      const spec = {
        id: 'u_test',
        language: 'universal',
        category: 'test',
        version: '1.0.0',
        blockDef: { type: 'u_test' },
      }
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'codeTemplate')).toBe(false)
      expect(errors.some((e: ValidationError) => e.field === 'astPattern')).toBe(false)
    })

    it('should require codeTemplate for language-specific blocks', () => {
      const spec = {
        id: 'c_test',
        language: 'cpp',
        category: 'test',
        version: '1.0.0',
        blockDef: { type: 'c_test' },
        astPattern: { nodeType: 'test', constraints: [] },
      }
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'codeTemplate')).toBe(true)
    })

    it('should require astPattern for language-specific blocks', () => {
      const spec = {
        id: 'c_test',
        language: 'cpp',
        category: 'test',
        version: '1.0.0',
        blockDef: { type: 'c_test' },
        codeTemplate: { pattern: 'test;', imports: [], order: 0 },
      }
      const errors = registry.validate(spec)
      expect(errors.some((e: ValidationError) => e.field === 'astPattern')).toBe(true)
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

    it('should filter by languageId when provided', () => {
      registry.register(createValidSpec({ id: 'c_for_loop', language: 'cpp', blockDef: { type: 'c_for_loop' }, category: 'loops' }))
      registry.register(createValidSpec({
        id: 'u_if',
        language: 'universal',
        blockDef: { type: 'u_if' },
        category: 'control',
        codeTemplate: undefined,
        astPattern: undefined,
      }))

      const cppToolbox = registry.toToolboxDef('cpp')
      expect(cppToolbox.contents).toHaveLength(2) // loops + control

      const pyToolbox = registry.toToolboxDef('python')
      expect(pyToolbox.contents).toHaveLength(1) // only control (universal)
      expect(pyToolbox.contents[0].contents[0].type).toBe('u_if')
    })
  })

  describe('US2: 自然語言標籤與符號調整', () => {
    let fullRegistry: BlockRegistry

    beforeEach(() => {
      fullRegistry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => fullRegistry.register(spec))
    })

    it('u_compare dropdown should use natural language labels', () => {
      const spec = fullRegistry.get('u_compare')!
      const dropdown = spec.blockDef.args0?.find((a: { name?: string }) => a.name === 'OP')
      expect(dropdown).toBeDefined()
      const labels = (dropdown as { options: string[][] }).options.map((o: string[]) => o[0])
      expect(labels).toContain('大於')
      expect(labels).toContain('小於')
      expect(labels).toContain('大於等於')
      expect(labels).toContain('小於等於')
      expect(labels).toContain('等於')
      expect(labels).toContain('不等於')
    })

    it('u_arithmetic dropdown should use × ÷ 餘數', () => {
      const spec = fullRegistry.get('u_arithmetic')!
      const dropdown = spec.blockDef.args0?.find((a: { name?: string }) => a.name === 'OP')
      expect(dropdown).toBeDefined()
      const labels = (dropdown as { options: string[][] }).options.map((o: string[]) => o[0])
      expect(labels).toContain('×')
      expect(labels).toContain('÷')
      expect(labels).toContain('餘數')
    })

    it('u_array_access message0 should use bracket notation', () => {
      const spec = fullRegistry.get('u_array_access')!
      expect(spec.blockDef.message0).toContain('[ %2 ]')
      expect(spec.blockDef.message0).not.toContain('的第')
    })
  })

  describe('toToolboxDef 工具箱分級過濾', () => {
    let fullRegistry: BlockRegistry

    beforeEach(() => {
      fullRegistry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => fullRegistry.register(spec))
    })

    it('beginner 模式只回傳 BEGINNER_BLOCKS 中的積木', () => {
      const toolbox = fullRegistry.toToolboxDef('cpp', 'beginner')
      const allBlockTypes = toolbox.contents.flatMap(cat => cat.contents.map(b => b.type))
      for (const blockType of allBlockTypes) {
        expect(BEGINNER_BLOCKS).toContain(blockType)
      }
      expect(allBlockTypes.length).toBe(BEGINNER_BLOCKS.length)
    })

    it('advanced 模式回傳全部積木', () => {
      const toolbox = fullRegistry.toToolboxDef('cpp', 'advanced')
      const allBlockTypes = toolbox.contents.flatMap(cat => cat.contents.map(b => b.type))
      expect(allBlockTypes.length).toBe(67)
    })

    it('不傳 level 時回傳全部積木（向後相容）', () => {
      const toolbox = fullRegistry.toToolboxDef('cpp')
      const allBlockTypes = toolbox.contents.flatMap(cat => cat.contents.map(b => b.type))
      expect(allBlockTypes.length).toBe(67)
    })

    it('beginner 模式分類數 ≤ 6', () => {
      const toolbox = fullRegistry.toToolboxDef('cpp', 'beginner')
      expect(toolbox.contents.length).toBeLessThanOrEqual(6)
    })

    it('beginner 模式隱藏 c_printf 但顯示 u_print', () => {
      const toolbox = fullRegistry.toToolboxDef('cpp', 'beginner')
      const allBlockTypes = toolbox.contents.flatMap(cat => cat.contents.map(b => b.type))
      expect(allBlockTypes).toContain('u_print')
      expect(allBlockTypes).not.toContain('c_printf')
      expect(allBlockTypes).not.toContain('c_scanf')
    })
  })

  describe('US1: 已刪除的 C++ 積木不應存在於 registry', () => {
    const deletedBlockIds = [
      'c_number', 'c_variable_ref', 'c_string_literal', 'c_binary_op',
      'cpp_cout', 'cpp_cin', 'cpp_endl', 'c_var_declare_init_expr',
    ]

    it('should not contain any of the 8 deleted C++ blocks after loading all definitions', () => {
      const fullRegistry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => fullRegistry.register(spec))

      for (const id of deletedBlockIds) {
        expect(fullRegistry.get(id), `${id} should not exist in registry`).toBeUndefined()
      }
    })
  })
})
