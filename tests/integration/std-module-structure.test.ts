import { describe, it, expect } from 'vitest'
import { allStdModules, createPopulatedRegistry } from '../../src/languages/cpp/std'

describe('Std module structure consistency', () => {
  it('every std module should have a non-empty header name', () => {
    for (const mod of allStdModules) {
      expect(mod.header).toBeTruthy()
      expect(mod.header.startsWith('<')).toBe(true)
      expect(mod.header.endsWith('>')).toBe(true)
    }
  })

  it('every std module should export registerGenerators function', () => {
    for (const mod of allStdModules) {
      expect(typeof mod.registerGenerators).toBe('function')
    }
  })

  it('every std module should export registerLifters function', () => {
    for (const mod of allStdModules) {
      expect(typeof mod.registerLifters).toBe('function')
    }
  })

  it('concepts and blocks should be arrays', () => {
    for (const mod of allStdModules) {
      expect(Array.isArray(mod.concepts)).toBe(true)
      expect(Array.isArray(mod.blocks)).toBe(true)
    }
  })

  it('all concept IDs should be unique across modules', () => {
    const seen = new Map<string, string>()
    for (const mod of allStdModules) {
      for (const concept of mod.concepts) {
        const existing = seen.get(concept.conceptId)
        if (existing) {
          throw new Error(`Duplicate concept "${concept.conceptId}" in ${mod.header} and ${existing}`)
        }
        seen.set(concept.conceptId, mod.header)
      }
    }
    // ⚠️ **不要錨在「std 模組裡還有幾顆」上**——那個數字隨膠囊搬家下降，
    // 而 `<cstdio>`／`<cstring>`／`<cctype>` 已經全空了。
    // 這支測試要問的是「有沒有重複的身分」，而那個檢查在上面的迴圈裡；
    // 錨改成「模組清單不是空的」，那是輸入量。
    expect(allStdModules.length, '一個 std 模組都沒有 → 量測壞了').toBeGreaterThan(3)
  })

  it('all block IDs should be unique across modules', () => {
    const seen = new Map<string, string>()
    for (const mod of allStdModules) {
      for (const block of mod.blocks) {
        const id = (block as any).id
        if (!id) continue
        const existing = seen.get(id)
        if (existing) {
          throw new Error(`Duplicate block "${id}" in ${mod.header} and ${existing}`)
        }
        seen.set(id, mod.header)
      }
    }
    // ⚠️ **不要錨在「std 模組裡還有幾顆」上**——那個數字隨膠囊搬家下降，
    // 而 `<cstdio>`／`<cstring>`／`<cctype>` 已經全空了。
    // 這支測試要問的是「有沒有重複的身分」，而那個檢查在上面的迴圈裡；
    // 錨改成「模組清單不是空的」，那是輸入量。
    expect(allStdModules.length, '一個 std 模組都沒有 → 量測壞了').toBeGreaterThan(3)
  })

  it('populated registry should have all module concepts mapped', () => {
    const registry = createPopulatedRegistry()
    for (const mod of allStdModules) {
      for (const concept of mod.concepts) {
        const header = registry.getHeaderForConcept(concept.conceptId)
        expect(header).toBe(mod.header)
      }
    }
  })

  it('populated registry should have universal IO concepts mapped to <iostream>', () => {
    const registry = createPopulatedRegistry()
    expect(registry.getHeaderForConcept('cpp:print')).toBe('<iostream>')
    expect(registry.getHeaderForConcept('cpp:input')).toBe('<iostream>')
    expect(registry.getHeaderForConcept('cpp:endl')).toBe('<iostream>')
  })

  it('should have 17 std modules', () => {
    expect(allStdModules).toHaveLength(17)
    const headers = allStdModules.map(m => m.header).sort()
    expect(headers).toEqual([
      '<algorithm>', '<cctype>', '<cmath>', '<cstdio>', '<cstdlib>', '<cstring>',
      '<fstream>', '<iostream>', '<map>', '<numeric>', '<queue>', '<set>',
      '<sstream>', '<stack>', '<string>', '<utility>', '<vector>',
    ])
  })
})
