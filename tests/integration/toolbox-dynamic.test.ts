import { describe, it, expect } from 'vitest'
import { CATEGORY_COLORS } from '../../src/ui/theme/category-colors'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'

describe('Toolbox 動態生成與顏色集中管理', () => {
  it('CATEGORY_COLORS 應包含所有主要類別', () => {
    const requiredCategories = ['data', 'operators', 'control', 'io', 'functions', 'arrays']
    for (const cat of requiredCategories) {
      expect(CATEGORY_COLORS[cat]).toBeDefined()
      expect(CATEGORY_COLORS[cat]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('CATEGORY_COLORS 的 C++ 類別應有定義', () => {
    const cppCategories = ['cpp_io', 'cpp_pointers', 'cpp_structs', 'cpp_strings', 'cpp_containers', 'cpp_special']
    for (const cat of cppCategories) {
      expect(CATEGORY_COLORS[cat]).toBeDefined()
    }
  })

  it('BlockSpecRegistry.getCategories() 應回傳不重複的類別', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromJSON([
      { id: 'a', language: 'cpp', category: 'data', version: '1', concept: { conceptId: 'a' }, blockDef: { type: 'a' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'x', constraints: [] } },
      { id: 'b', language: 'cpp', category: 'data', version: '1', concept: { conceptId: 'b' }, blockDef: { type: 'b' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'y', constraints: [] } },
      { id: 'c', language: 'cpp', category: 'control', version: '1', concept: { conceptId: 'c' }, blockDef: { type: 'c' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'z', constraints: [] } },
    ] as any)
    const cats = registry.getCategories()
    expect(cats).toContain('data')
    expect(cats).toContain('control')
    expect(cats.length).toBe(2)
  })

  it('BlockSpecRegistry.listByCategory 應按可見概念過濾', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromJSON([
      { id: 'a', language: 'cpp', category: 'data', version: '1', concept: { conceptId: 'a' }, blockDef: { type: 'a' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'x', constraints: [] } },
      { id: 'b', language: 'cpp', category: 'data', version: '1', concept: { conceptId: 'b' }, blockDef: { type: 'b' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'y', constraints: [] } },
    ] as any)
    expect(registry.listByCategory('data', new Set(['a']))).toHaveLength(1)
    expect(registry.listByCategory('data')).toHaveLength(2)
  })
})
