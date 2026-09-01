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
  it('專注：一組——所有東西是同一組裡的分頁', () => {
    const p = plan('focus')
    expect(p.layout).toEqual({ orientation: 0, groups: [{}] })
    expect(p.columnOf.get('space')).toBe(1)
  })

  it('對照：程式碼 ｜ 積木——兩組並排', () => {
    const p = plan('compare')
    expect(p.layout).toEqual({ orientation: 0, groups: [{}, {}] })
    expect([...p.columnOf]).toEqual([['element', 1], ['space', 2]])
  })

  it('三欄：程式碼 ｜ 流程 ｜ 積木', () => {
    const p = plan('three-column')
    expect(p.layout).toEqual({ orientation: 0, groups: [{}, {}, {}] })
    expect([...p.columnOf]).toEqual([['element', 1], ['relation', 2], ['space', 3]])
  })

  it('🔴 十字：左邊程式碼，右邊【上下拆兩格】——流程在上、積木在下', () => {
    const p = plan('grid')
    expect(p.layout).toEqual({ orientation: 0, groups: [{}, { groups: [{}, {}] }] })
    expect([...p.columnOf]).toEqual([['element', 1], ['relation', 2], ['space', 3]])
  })
})

describe('🔴 主控台不佔編輯器分組——它是 IDE 的終端機', () => {
  it('對照的左欄是「程式碼在上、主控台在下」，而分組只有程式碼', () => {
    expect(plan('compare').columnOf.has('state')).toBe(false)
  })

  it('⚠️ 拿掉主控台之後整欄空掉的話，那一欄不產生分組', () => {
    // 專注 ＝ [['*'],['state']]：第二列整列是主控台，拿掉之後只剩一格。
    expect(plan('focus').layout.groups).toHaveLength(1)
  })

  it('積木跨兩列時算【一格】，不是兩格', () => {
    // 對照的右欄是 [積木, 積木]——相鄰而相同，收成一格。
    expect(plan('compare').layout.groups[1]).toEqual({})
  })
})

describe('專注的 `*` 跟著焦點走', () => {
  it('焦點在流程時，那一組是流程', () => {
    expect([...plan('focus', 'relation').columnOf]).toEqual([['relation', 1]])
  })
})
