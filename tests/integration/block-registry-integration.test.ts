import { describe, it, expect, beforeEach } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import type { BlockSpec } from '../../src/core/types'
import sampleForLoop from '../fixtures/block-specs/sample-for-loop.json'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

function createSpec(id: string, category: string, nodeType: string): BlockSpec {
  return {
    id,
    language: 'cpp',
    category,
    version: '1.0.0',
    blockDef: { type: id, message0: `${id} block`, colour: 120 },
    codeTemplate: { pattern: `/* ${id} */`, imports: [], order: 0 },
    astPattern: { nodeType, constraints: [] },
  }
}

describe('BlockRegistry 整合測試', () => {
  let registry: BlockRegistry

  beforeEach(() => {
    registry = new BlockRegistry()
  })

  describe('載入多份定義檔', () => {
    it('should load sample-for-loop.json fixture as BlockSpec', () => {
      registry.register(sampleForLoop as BlockSpec)
      const spec = registry.get('c_for_loop')
      expect(spec).toBeDefined()
      expect(spec!.category).toBe('loops')
      expect(spec!.astPattern!.nodeType).toBe('for_statement')
    })

    it('should register multiple specs from different categories', () => {
      const specs = [
        createSpec('c_for_loop', 'loops', 'for_statement'),
        createSpec('c_while_loop', 'loops', 'while_statement'),
        createSpec('c_if', 'conditions', 'if_statement'),
        createSpec('c_printf', 'io', 'call_expression'),
        createSpec('c_variable_decl', 'variables', 'declaration'),
      ]

      specs.forEach(s => registry.register(s))

      expect(registry.getByCategory('loops')).toHaveLength(2)
      expect(registry.getByCategory('conditions')).toHaveLength(1)
      expect(registry.getByCategory('io')).toHaveLength(1)
      expect(registry.getByCategory('variables')).toHaveLength(1)
    })

    it('should generate complete toolbox with all categories', () => {
      const specs = [
        createSpec('c_for_loop', 'loops', 'for_statement'),
        createSpec('c_while_loop', 'loops', 'while_statement'),
        createSpec('c_if', 'conditions', 'if_statement'),
        createSpec('c_printf', 'io', 'call_expression'),
      ]

      specs.forEach(s => registry.register(s))

      const toolbox = registry.toToolboxDef()
      expect(toolbox.contents).toHaveLength(3)

      const categoryNames = toolbox.contents.map((c: { name?: string }) => c.name)
      expect(categoryNames).toContain('loops')
      expect(categoryNames).toContain('conditions')
      expect(categoryNames).toContain('io')
    })

    it('should allow querying by node type across all registered specs', () => {
      registry.register(createSpec('c_for_loop', 'loops', 'for_statement'))
      registry.register(createSpec('c_while_loop', 'loops', 'while_statement'))
      registry.register(createSpec('c_if', 'conditions', 'if_statement'))

      expect(registry.getByNodeType('for_statement')).toHaveLength(1)
      expect(registry.getByNodeType('while_statement')).toHaveLength(1)
      expect(registry.getByNodeType('if_statement')).toHaveLength(1)
      expect(registry.getByNodeType('nonexistent')).toHaveLength(0)
    })
  })

  describe('ID 衝突偵測', () => {
    it('should throw error when registering duplicate id', () => {
      const spec = createSpec('c_for_loop', 'loops', 'for_statement')
      registry.register(spec)
      expect(() => registry.register(spec)).toThrow()
    })

    it('should throw error with descriptive message on duplicate', () => {
      const spec = createSpec('c_for_loop', 'loops', 'for_statement')
      registry.register(spec)
      expect(() => registry.register(spec)).toThrow(/c_for_loop/)
    })

    it('should allow re-registration after unregister', () => {
      const spec = createSpec('c_for_loop', 'loops', 'for_statement')
      registry.register(spec)
      registry.unregister('c_for_loop')

      const updated = createSpec('c_for_loop', 'loops', 'for_statement')
      updated.version = '2.0.0'
      expect(() => registry.register(updated)).not.toThrow()
      expect(registry.get('c_for_loop')!.version).toBe('2.0.0')
    })
  })

  describe('格式錯誤處理', () => {
    it('should reject spec with missing required fields', () => {
      const invalid = { id: 'test' } as unknown as BlockSpec
      expect(() => registry.register(invalid)).toThrow()
    })

    it('should reject spec with empty id', () => {
      const spec = createSpec('', 'loops', 'for_statement')
      expect(() => registry.register(spec)).toThrow()
    })

    it('should reject spec with mismatched blockDef.type', () => {
      const spec = createSpec('c_for_loop', 'loops', 'for_statement')
      spec.blockDef = { type: 'wrong_name', message0: 'test', colour: 120 }
      expect(() => registry.register(spec)).toThrow()
    })

    it('should provide detailed validation errors', () => {
      const errors = registry.validate({} as unknown)
      expect(errors.length).toBeGreaterThan(0)
      errors.forEach(e => {
        expect(e.field).toBeTruthy()
        expect(e.message).toBeTruthy()
      })
    })

    it('should validate fixture file structure', () => {
      const errors = registry.validate(sampleForLoop)
      expect(errors).toEqual([])
    })
  })

  describe('US1: 刪除 8 個重複積木後工具箱數量減少', () => {
    it('should have reduced block count after removing 8 duplicates (67 = 75 - 8)', () => {
      const fullRegistry = new BlockRegistry()
      const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
      allBlocks.forEach(spec => fullRegistry.register(spec))

      const toolbox = fullRegistry.toToolboxDef('cpp')
      let totalBlocks = 0
      for (const category of toolbox.contents) {
        if (category.contents) {
          totalBlocks += category.contents.length
        }
      }

      // After US1: removed c_number, c_variable_ref, c_string_literal, c_binary_op,
      // cpp_cout, cpp_cin, cpp_endl, c_var_declare_init_expr (8 blocks)
      // Remaining: 23 universal + 9 basic + 26 advanced + 9 special = 67
      expect(totalBlocks).toBe(67)
    })
  })
})
