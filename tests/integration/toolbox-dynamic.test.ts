import { describe, it, expect } from 'vitest'
import { cppCategoryDefs } from '../../src/languages/cpp/toolbox-categories'
import { pythonCategoryDefs } from '../../src/languages/python/toolbox-categories'
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

  /**
   * ⚠️ **這條原本叫「C++ 類別」，而那批鍵在 2026-08-22 正名了**：
   * 它們記的是**語義**（字串是綠松色、對應表是藍色），與那段程式是哪個語言無關。
   *
   * > **一個記著語義的東西，名字裡不該有語言。**
   *
   * 🔴 而這條測試要釘的東西沒有變：**每一個被 `colorKey` 指名的鍵都要有顏色**
   * ——查不到時是 `undefined` → `setColour(undefined)` 拋錯 → 整個 flyout 中斷。
   * 所以改成**從兩個語言的分類宣告推**，而不是手抄一份會過期的清單。
   */
  it('每一個分類宣告指名的顏色鍵，都要有顏色', () => {
    const keys = [...cppCategoryDefs, ...pythonCategoryDefs].map((d) => d.colorKey)
    expect(keys.length, '分類宣告是空的 → 下面在驗空集合').toBeGreaterThan(10)
    for (const k of new Set(keys)) {
      expect(CATEGORY_COLORS[k], `分類指名了 \`${k}\` 而調色盤裡沒有`).toBeDefined()
    }
  })

  it('BlockSpecRegistry.getCategories() 應回傳不重複的類別', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromJSON([
      { id: 'a', language: 'cpp', category: 'data', version: '1', componentMapping: { componentId: 'a' }, blockDef: { type: 'a' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'x', constraints: [] } },
      { id: 'b', language: 'cpp', category: 'data', version: '1', componentMapping: { componentId: 'b' }, blockDef: { type: 'b' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'y', constraints: [] } },
      { id: 'c', language: 'cpp', category: 'control', version: '1', componentMapping: { componentId: 'c' }, blockDef: { type: 'c' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'z', constraints: [] } },
    ] as any)
    const cats = registry.getCategories()
    expect(cats).toContain('data')
    expect(cats).toContain('control')
    expect(cats.length).toBe(2)
  })

  it('BlockSpecRegistry.listByCategory 應按可見概念過濾', () => {
    const registry = new BlockSpecRegistry()
    registry.loadFromJSON([
      { id: 'a', language: 'cpp', category: 'data', version: '1', componentMapping: { componentId: 'a' }, blockDef: { type: 'a' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'x', constraints: [] } },
      { id: 'b', language: 'cpp', category: 'data', version: '1', componentMapping: { componentId: 'b' }, blockDef: { type: 'b' }, codeTemplate: { pattern: '', imports: [], order: 0 }, astPattern: { nodeType: 'y', constraints: [] } },
    ] as any)
    expect(registry.listByCategory('data', new Set(['a']))).toHaveLength(1)
    expect(registry.listByCategory('data')).toHaveLength(2)
  })
})
