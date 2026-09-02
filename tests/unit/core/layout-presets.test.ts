/**
 * **三個純函數釘住**：套用、示意圖、看得到哪幾層——全部從**同一份 `areas`** 導出。
 *
 * 🔴 這一支存在的理由是 SC-004：「新增一個版面只需要改**一份宣告**」。
 * 少了它，示意圖有可能悄悄長出第二份資料，而**漂開時沒有任何機構會出聲**。
 *
 * 🪦 **2026-09-02（spec 171）改寫**：十字退場、主控台搬出編輯區之後，
 * 三張版面全是純欄。原本守「跨格算一格」「十字是四格、每格 1×1」「左欄不動」
 * 那三條**守的東西不存在了**——不是它們擋路，是**跨格本身不存在了**
 * （唯一有跨格的版面是十字，而它跨格只因為主控台佔了左下那一格）。
 *
 * ⚠️ 而「跨格算一格」這件事本身沒有被廢：`thumbnailCells` 仍然算它，
 * 下面那條合成的宣告釘住它——只是**現有的三張都用不到**。
 */
import { describe, it, expect } from 'vitest'
import {
  LAYOUT_PRESETS, layoutPreset, gridTemplateAreas, thumbnailCells, occupiedLayers,
  type LayoutPresetSpec,
} from '../../../src/core/host/layout-presets'

const P = (id: string): LayoutPresetSpec => layoutPreset(id as never)!

describe('版面宣告的三個純函數', () => {
  it('★ 入口條件：三個版面都在', () => {
    // 錨在**宣告了幾個**（合成量），不是「有幾個對的」
    expect(LAYOUT_PRESETS.length).toBe(3)
  })

  it('gridTemplateAreas：三份宣告各自的 CSS 字串——每一份都是【一列】', () => {
    expect(gridTemplateAreas(P('compare'))).toBe('"element space"')
    expect(gridTemplateAreas(P('three-column'))).toBe('"element relation space"')
  })

  it('🔴 `*` 要被當下那一層代換——不代換的話「專注」會是一格 CSS 認不得的東西', () => {
    expect(gridTemplateAreas(P('focus'), 'space')).toBe('"space"')
    expect(gridTemplateAreas(P('focus'), 'relation')).toBe('"relation"')
    expect(gridTemplateAreas(P('focus'))).toBe('"element"')   // 預設
  })

  it('thumbnailCells：一列並排，位置逐格對得上宣告', () => {
    const c = thumbnailCells(P('three-column'))
    expect(c.map((x) => x.layer)).toEqual(['element', 'relation', 'space'])
    expect(c.map((x) => x.col)).toEqual([1, 2, 3])
    expect(c.every((x) => x.row === 1 && x.rowSpan === 1 && x.colSpan === 1)).toBe(true)
  })

  it('🔴 現有的三張【沒有任何一張跨格】——跨格是主控台在編輯區裡那個時代的形狀', () => {
    for (const p of LAYOUT_PRESETS) {
      const c = thumbnailCells(p)
      expect(c.every((x) => x.rowSpan === 1 && x.colSpan === 1), `${p.id} 有跨格`).toBe(true)
    }
  })

  it('⚠️ 而「跨格算一格」本身還在——餵一張合成的宣告給它', () => {
    // 這條守的是**函式**，不是**現有的版面**：哪天再出現跨格的版面，
    // 它不會悄悄變成兩格。
    const fake = {
      id: 'compare', nameKey: 'x',
      areas: [['element', 'space'], ['relation', 'space']],
    } as unknown as LayoutPresetSpec
    const c = thumbnailCells(fake)
    expect(c.map((x) => x.layer)).toEqual(['element', 'space', 'relation'])
    expect(c.find((x) => x.layer === 'space')).toMatchObject({ row: 1, col: 2, rowSpan: 2, colSpan: 1 })
  })

  it('🔴 從「對照」切到「三欄」，程式碼那一格不動（SC-003 的宣告側）', () => {
    // 🪦 2026-09-01 釘的是「切到十字時整個左欄不動」。十字退場之後，
    //    留得住的是**這一條**：加一欄流程，而程式碼還在第一欄第一列。
    const at = (id: string, layer: string) =>
      thumbnailCells(P(id)).find((x) => x.layer === layer)
    expect(at('compare', 'element')).toMatchObject({ row: 1, col: 1 })
    expect(at('three-column', 'element')).toMatchObject({ row: 1, col: 1 })
    // ⚠️ 而積木**會**移動——流程插在中間，那是「三欄」的定義不是缺陷
    expect(at('compare', 'space')).toMatchObject({ col: 2 })
    expect(at('three-column', 'space')).toMatchObject({ col: 3 })
  })

  it('occupiedLayers：這個版面看得到哪幾層——⚠️ 都不含主控台', () => {
    expect([...occupiedLayers(P('compare'))].sort()).toEqual(['element', 'space'])
    expect([...occupiedLayers(P('three-column'))].sort())
      .toEqual(['element', 'relation', 'space'])
    expect([...occupiedLayers(P('focus'), 'relation')].sort()).toEqual(['relation'])
  })

  it('★ 注入（不亂報）：問一個不存在的版面要回 undefined', () => {
    expect(layoutPreset('nope' as never)).toBeUndefined()
    expect(layoutPreset('grid' as never), '十字已退場').toBeUndefined()
  })
})
