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

  it('★ 模組**不再有註冊路**——那三個欄位是 F 完成之後刪掉的', () => {
    // ⚠️ 這兩支原本斷言 `typeof mod.registerGenerators === 'function'`，
    // 而那條紀律的前提在 2026-08-11 消失了：177 顆元件全部搬進膠囊之後，
    // **43 個註冊函式全部是空的**，其中 38 個檔除了那個空殼什麼都沒有。
    //
    // > **一條「必填」的紀律，在它要防的東西消失之後，就只剩下 43 個殼。**
    //
    // 那條紀律搬到了膠囊：`component.json` 的 `paths` 五路缺一不可，
    // 沒有那一路要寫 `null` ＋ `_why`。
    //
    // 這裡改成**釘住它們不得回來**——否則下一個人會「順手」把它們加回去。
    for (const mod of allStdModules) {
      expect(mod, `${mod.header} 又長出註冊路了——五路的紀律在膠囊那邊`)
        .not.toHaveProperty('registerGenerators')
      expect(mod).not.toHaveProperty('registerLifters')
      expect(mod).not.toHaveProperty('registerExecutors')
    }
  })

  it('components and blocks should be arrays', () => {
    for (const mod of allStdModules) {
      expect(Array.isArray(mod.components)).toBe(true)
      expect(Array.isArray(mod.blocks)).toBe(true)
    }
  })

  it('all component IDs should be unique across modules', () => {
    const seen = new Map<string, string>()
    for (const mod of allStdModules) {
      for (const component of mod.components) {
        const existing = seen.get(component.componentId)
        if (existing) {
          throw new Error(`Duplicate component "${component.componentId}" in ${mod.header} and ${existing}`)
        }
        seen.set(component.componentId, mod.header)
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

  it('populated registry should have all module components mapped', () => {
    const registry = createPopulatedRegistry()
    for (const mod of allStdModules) {
      for (const component of mod.components) {
        const header = registry.getHeaderForComponent(component.componentId)
        expect(header).toBe(mod.header)
      }
    }
  })

  it('populated registry should have universal IO components mapped to <iostream>', () => {
    const registry = createPopulatedRegistry()
    expect(registry.getHeaderForComponent('cpp:print')).toBe('<iostream>')
    expect(registry.getHeaderForComponent('cpp:input')).toBe('<iostream>')
    expect(registry.getHeaderForComponent('cpp:endl')).toBe('<iostream>')
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
