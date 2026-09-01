/**
 * **三個純函數釘住**：套用、示意圖、看得到哪幾層——全部從**同一份 `areas`** 導出。
 *
 * 🔴 這一支存在的理由是 SC-004：「新增一個版面只需要改**一份宣告**」。
 * 少了它，示意圖有可能悄悄長出第二份資料，而**漂開時沒有任何機構會出聲**。
 */
import { describe, it, expect } from 'vitest'
import {
  LAYOUT_PRESETS, layoutPreset, gridTemplateAreas, thumbnailCells, occupiedLayers,
} from '../../../src/core/host/layout-presets'

const P = (id: string) => layoutPreset(id as never)!

describe('版面宣告的三個純函數', () => {
  it('★ 入口條件：四個版面都在', () => {
    // 錨在**宣告了幾個**（合成量），不是「有幾個對的」
    expect(LAYOUT_PRESETS.length).toBe(4)
  })

  it('gridTemplateAreas：四份宣告各自的 CSS 字串', () => {
    expect(gridTemplateAreas(P('compare'))).toBe('"element space" "state space"')
    expect(gridTemplateAreas(P('three-column')))
      .toBe('"element relation space" "state relation space"')
    expect(gridTemplateAreas(P('grid'))).toBe('"element relation" "state space"')
  })

  it('🔴 `*` 要被當下那一層代換——不代換的話「專注」會是一格 CSS 認不得的東西', () => {
    expect(gridTemplateAreas(P('focus'), 'space')).toBe('"space" "state"')
    expect(gridTemplateAreas(P('focus'), 'relation')).toBe('"relation" "state"')
    expect(gridTemplateAreas(P('focus'))).toBe('"element" "state"')   // 預設
  })

  it('thumbnailCells：跨格算【一格】，而不是兩格', () => {
    // 對照：積木跨兩列 → 三格，不是四格
    const c = thumbnailCells(P('compare'))
    expect(c.map((x) => x.layer)).toEqual(['element', 'space', 'state'])
    expect(c.find((x) => x.layer === 'space')).toMatchObject({ row: 1, col: 2, rowSpan: 2, colSpan: 1 })
    expect(c.find((x) => x.layer === 'state')).toMatchObject({ row: 2, col: 1, rowSpan: 1, colSpan: 1 })
  })

  it('🔴 十字是四格，每格 1×1——「沒有任何一層是特別的」是可量的', () => {
    const c = thumbnailCells(P('grid'))
    expect(c.map((x) => x.layer)).toEqual(['element', 'relation', 'state', 'space'])
    expect(c.every((x) => x.rowSpan === 1 && x.colSpan === 1), '有一格比別人大').toBe(true)
  })

  it('🔴 從「對照」切到「十字」，【整個左欄】的格子位置不變（SC-003 的宣告側）', () => {
    // 🪦 2026-09-01 之前釘的是「程式碼**與積木**不動」。使用者把十字改成
    //    `element,relation ／ state,space` 之後，保住的是**更大的一塊**：
    //    整個左欄與「對照」逐格相同——只有積木讓位給流程。
    const at = (id: string, layer: string) =>
      thumbnailCells(P(id)).find((x) => x.layer === layer)
    expect(at('compare', 'element')).toMatchObject({ row: 1, col: 1 })
    expect(at('grid', 'element')).toMatchObject({ row: 1, col: 1 })
    expect(at('compare', 'state')).toMatchObject({ row: 2, col: 1 })
    expect(at('grid', 'state')).toMatchObject({ row: 2, col: 1 })
    // ⚠️ 而積木**會**移動——那是十字的定義（流程進來了），不是缺陷
    expect(at('compare', 'space')).toMatchObject({ row: 1, col: 2 })
    expect(at('grid', 'space')).toMatchObject({ row: 2, col: 2 })
  })

  it('occupiedLayers：這個版面看得到哪幾層', () => {
    expect([...occupiedLayers(P('compare'))].sort()).toEqual(['element', 'space', 'state'])
    expect([...occupiedLayers(P('grid'))].sort()).toEqual(['element', 'relation', 'space', 'state'])
    expect([...occupiedLayers(P('focus'), 'relation')].sort()).toEqual(['relation', 'state'])
  })

  it('★ 注入（不亂報）：問一個不存在的版面要回 undefined', () => {
    expect(layoutPreset('nope' as never)).toBeUndefined()
  })
})
