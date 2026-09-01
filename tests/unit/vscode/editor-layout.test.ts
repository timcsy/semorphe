/**
 * 🔴 版面宣告 → VSCode 的編輯器分組。
 *
 * 使用者 2026-09-01：「我現在要如何切換佈局？」→「我要的就是這個，
 * 你怎麼現在才聽懂？」——版面沒有消失，它換了執行者。
 */
import { describe, it, expect } from 'vitest'
import { planEditorLayout } from '../../../src/vscode/editor-layout'
import { layoutPreset, type LayoutPresetId } from '../../../src/core/host/layout-presets'
import type { UnderstandingLayer } from '../../../src/core/view-host'

const plan = (id: LayoutPresetId, focus: UnderstandingLayer = 'space') =>
  planEditorLayout(layoutPreset(id)!, focus)

describe('四張版面在 VSCode 的編輯器分組', () => {
  it('專注：一欄上下兩格——目前那一層在上、主控台在下', () => {
    const p = plan('focus')
    expect(p.layout).toEqual({ orientation: 0, groups: [{ groups: [{}, {}] }] })
    expect([...p.columnOf]).toEqual([['space', 1], ['state', 2]])
  })

  it('對照：（程式碼／主控台）｜ 積木', () => {
    const p = plan('compare')
    expect(p.layout).toEqual({ orientation: 0, groups: [{ groups: [{}, {}] }, {}] })
    expect([...p.columnOf]).toEqual([['element', 1], ['state', 2], ['space', 3]])
  })

  it('三欄：（程式碼／主控台）｜ 流程 ｜ 積木', () => {
    const p = plan('three-column')
    expect(p.layout).toEqual({ orientation: 0, groups: [{ groups: [{}, {}] }, {}, {}] })
    expect([...p.columnOf])
      .toEqual([['element', 1], ['state', 2], ['relation', 3], ['space', 4]])
  })

  it('🔴 十字：真的是 2×2——左上程式碼、左下主控台、右上流程、右下積木', () => {
    const p = plan('grid')
    expect(p.layout).toEqual({
      orientation: 0, groups: [{ groups: [{}, {}] }, { groups: [{}, {}] }],
    })
    expect([...p.columnOf])
      .toEqual([['element', 1], ['state', 2], ['relation', 3], ['space', 4]])
  })
})

describe('🟢 主控台收回成一個面板之後，四層都佔一格', () => {
  it('🔴 「十字（四格，每一層一格）」在 VSCode 真的有四格', () => {
    expect(plan('grid').columnOf.size).toBe(4)
  })

  it('積木跨兩列時算【一格】，不是兩格', () => {
    // 對照的右欄是 [積木, 積木]——相鄰而相同，收成一格。
    expect(plan('compare').layout.groups[1]).toEqual({})
  })
})

describe('專注的 `*` 跟著焦點走', () => {
  it('焦點在流程時，那一組是流程', () => {
    expect([...plan('focus', 'relation').columnOf]).toEqual([['relation', 1], ['state', 2]])
  })
})

describe('🔴 回傳的是【順序】，不是 ViewColumn 的號碼', () => {
  // 2026-09-01 實測：使用者按了十字，程式碼左上 ✅、流程右上 ✅、積木右下 ✅，
  // 而**主控台跑去跟流程擠同一組**，左下留了一格空的。
  // ⚠️ `ViewColumn` 的號碼是 VSCode 自己的分組編號，巢狀重排之後它與
  //    「由左到右、由上到下」不一致——所以執行時要**問**，不要**數**。
  it('十字的順序是：程式碼 → 主控台 → 流程 → 積木', () => {
    expect(plan('grid').order).toEqual(['element', 'state', 'relation', 'space'])
  })

  it('順序的長度 ＝ 分組的個數——逐項對得起來', () => {
    const count = (gs: { groups?: unknown[] }[]): number =>
      gs.reduce((n, g) => n + (g.groups ? count(g.groups as never) : 1), 0)
    for (const id of ['focus', 'compare', 'three-column', 'grid'] as const) {
      const p = plan(id)
      expect(p.order.length, `${id} 的順序與分組數對不上`).toBe(count(p.layout.groups))
    }
  })

  it('⚠️ columnOf 由 order 導出——只給說明用，不得當成 ViewColumn', () => {
    const p = plan('grid')
    expect([...p.columnOf]).toEqual(p.order.map((l, i) => [l, i + 1]))
  })
})
